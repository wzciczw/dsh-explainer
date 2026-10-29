import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import * as React from 'react'

// A DOM must exist before react-dom is imported.
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://127.0.0.1:1/',
  pretendToBeVisual: false,
  runScripts: 'outside-only',
})
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
dom.window.TextDecoder = globalThis.TextDecoder
dom.window.requestAnimationFrame = (callback) => setTimeout(callback, 0)
dom.window.cancelAnimationFrame = (handle) => clearTimeout(handle)
global.requestAnimationFrame = dom.window.requestAnimationFrame
global.cancelAnimationFrame = dom.window.cancelAnimationFrame

// jsdom has no layout; give ranges a real rect so selection detection accepts them.
const RECT = { left: 120, top: 120, right: 280, bottom: 142, width: 160, height: 22, x: 120, y: 120 }
dom.window.Range.prototype.getBoundingClientRect = () => RECT
dom.window.Range.prototype.getClientRects = () => [RECT]

const { createRoot } = await import('react-dom/client')
const testUtils = await import('react-dom/test-utils')
const act = React.act ?? testUtils.act

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function loadBundle() {
  let entry
  dom.window.__ModuleLoader__ = { load: (value) => { entry = value } }
  dom.window.eval(source)
  assert.ok(entry !== undefined)
  return entry.factory((id) => {
    if (id === 'react') return React
    throw new Error(`unexpected require ${id}`)
  })
}

function harness() {
  const module = loadBundle()
  const registrations = []
  const ctx = {
    slots: {
      inject: (key, register) => { register() },
      register: (options, component) => { registrations.push({ options, component }); return () => {} },
    },
    locale: { register: () => () => {}, bind: () => (key) => key },
    effect: (fn) => { fn() },
  }
  module.apply(ctx)
  return registrations
}

function setTextarea(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')
  descriptor.set.call(element, value)
  element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

function sse(frames) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

test('the window opens, streams an answer and keeps follow-ups on one thread', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  const composer = registrations.find(item => item.options.id === 'explainer.quick')
  assert.ok(overlay !== undefined && composer !== undefined)

  const requests = []
  const inserted = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: { enabled: true, showMeta: true, selectionMaxChars: 6000, inheritContext: true, presets: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    const body = JSON.parse(init.body)
    requests.push(body)
    const label = requests.length === 1 ? '创建便宜' : '合并费钱'
    return sse([
      'event: meta\ndata: {"provider":"p","model":"m","effort":"off"}\n\n',
      `event: delta\ndata: ${JSON.stringify({ text: label })}\n\n`,
      'event: done\ndata: {"ms":12}\n\n',
    ])
  }

  const composerElement = dom.window.document.createElement('div')
  composerElement.setAttribute('data-slot', 'conversation.composer')
  document.body.appendChild(composerElement)

  const inputActions = {
    captureInsertion: () => ({ draftRev: 0 }),
    insertText: (text) => { inserted.push(text); return true },
    setDraft: () => {},
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })
  const useInput = (select) => select({ draft: '' })

  await act(async () => {
    root.render(React.createElement(
      React.Fragment,
      null,
      React.createElement(overlay.component, { useSessions }),
      React.createElement(composer.component, {
        sessionId: 's1',
        inputActions,
        useInput,
        useProjection: (key, select) => select({ next: { provider: 'main-provider', model: 'main-model' } }),
      }),
    ))
  })

  const launcher = container.querySelector('.dx-launcher')
  assert.ok(launcher !== null, 'the composer launcher is rendered')
  await act(async () => { launcher.click() })
  assert.ok(container.querySelector('.dx-card') !== null, 'the window opens')

  const textarea = container.querySelector('.dx-input')
  assert.ok(textarea !== null)
  await act(async () => { setTextarea(textarea, '解释一下分支成本') })
  const send = container.querySelector('.dx-send')
  await act(async () => { send.click(); await new Promise(resolve => setTimeout(resolve, 30)) })

  const answer = container.querySelector('.dx-turn[data-role="assistant"] .dx-md')
  assert.ok(answer !== null)
  assert.match(answer.textContent, /创建便宜/)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].mode, 'quick')
  assert.equal(requests[0].inheritContext, false)
  assert.equal(requests[0].provider, 'main-provider', 'the ask follows the main window model')
  assert.equal(requests[0].model, 'main-model')

  const threadId = requests[0].threadId

  const follow = container.querySelector('.dx-input')
  await act(async () => { setTextarea(follow, '那 merge 呢') })
  await act(async () => {
    container.querySelector('.dx-send').click()
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(requests.length, 2)
  assert.equal(requests[1].threadId, threadId, 'a follow-up reuses the isolated thread')
  assert.equal('selection' in requests[1], false)

  const insert = [...container.querySelectorAll('.dx-mini')].find(button => button.textContent === 'insert')
  assert.ok(insert !== undefined)
  await act(async () => { insert.click() })
  assert.equal(inserted.length, 1)
  assert.match(inserted[0], /合并费钱/)

  // Clicking outside closes the window outright; no restore chip is left.
  await act(async () => {
    document.body.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }))
  })
  assert.equal(container.querySelector('.dx-card'), null, 'outside click closes the window')
  assert.equal(container.querySelector('.dx-restore'), null, 'no restore chip is left behind')

  await act(async () => { root.unmount() })
  container.remove()
})

test('right-clicking a chat selection opens the window directly', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  assert.ok(overlay !== undefined)

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })

  await act(async () => {
    root.render(React.createElement(overlay.component, { useSessions }))
  })

  const chat = document.createElement('div')
  chat.setAttribute('data-slot', 'conversation.chat.flow')
  chat.textContent = 'LayerFS 的 Branch 创建很便宜。'
  document.body.appendChild(chat)

  await act(async () => {
    const node = chat.firstChild
    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, 12)
    const selection = dom.window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    const event = new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    chat.dispatchEvent(event)
    assert.equal(event.defaultPrevented, true, 'the native menu is suppressed')
  })

  const card = container.querySelector('.dx-card')
  assert.ok(card !== null, 'right-click opens the window')
  assert.match(card.querySelector('.dx-quote').textContent, /LayerFS/)

  await act(async () => {
    document.body.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }))
  })
  assert.equal(container.querySelector('.dx-card'), null)

  await act(async () => { root.unmount() })
  chat.remove()
  container.remove()
})