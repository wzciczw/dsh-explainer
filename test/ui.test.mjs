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

test('a pinned default model labels the window and leads every request', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  const composer = registrations.find(item => item.options.id === 'explainer.quick')
  assert.ok(overlay !== undefined && composer !== undefined)

  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({
        ok: true,
        config: {
          enabled: true,
          showMeta: true,
          selectionMaxChars: 6000,
          inheritContext: true,
          presets: [],
          rightClick: true,
          defaultModel: { provider: 'newapi-gemini', model: 'gemini-3.8-flash' },
          pinnedModel: { provider: 'newapi-gemini', model: 'gemini-3.8-flash' },
          modelGroups: [
            { id: 'newapi', name: '公司', models: [{ id: 'deepseek-flash', name: 'deepseek-flash' }] },
            { id: 'newapi-gemini', name: '公司 Gemini', models: [{ id: 'gemini-3.8-flash', name: 'gemini-3.8-flash' }] },
          ],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"newapi-gemini","model":"gemini-3.8-flash","effort":"low"}\n\n',
      'event: delta\ndata: {"text":"好的"}\n\n',
      'event: done\ndata: {"ms":3}\n\n',
    ])
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
        inputActions: { captureInsertion: () => ({}), insertText: () => true, setDraft: () => {} },
        useInput,
        // The main chat is on another model; the pin must win for the window.
        useProjection: (key, select) => select({ next: { provider: 'newapi', model: 'deepseek-flash' } }),
      }),
    ))
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  await act(async () => { container.querySelector('.dx-launcher').click() })
  const card = container.querySelector('.dx-card')
  assert.ok(card !== null)
  const badge = card.querySelector('.dx-model')
  assert.ok(badge !== null, 'the window labels its default model')
  assert.equal(badge.textContent.trim(), 'gemini-3.8-flash')
  assert.match(badge.getAttribute('title'), /pinnedModel/)

  await act(async () => {
    setTextarea(card.querySelector('.dx-input'), '这是什么')
    card.querySelector('.dx-send').click()
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].provider, 'newapi-gemini')
  assert.equal(requests[0].model, 'gemini-3.8-flash')

  const meta = container.querySelector('.dx-meta')
  assert.match(meta.textContent, /gemini-3\.8-flash/)

  await act(async () => { root.unmount() })
  container.remove()
})

test('a pinned model the catalog no longer lists falls back to the main chat model', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  const composer = registrations.find(item => item.options.id === 'explainer.quick')
  assert.ok(overlay !== undefined && composer !== undefined)

  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({
        ok: true,
        config: {
          enabled: true,
          showMeta: true,
          selectionMaxChars: 6000,
          inheritContext: true,
          presets: [],
          defaultModel: { provider: 'newapi-gemini', model: 'gemini-0-retired' },
          modelGroups: [{ id: 'newapi', name: '公司', models: [{ id: 'deepseek-flash', name: 'deepseek-flash' }] }],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"newapi","model":"deepseek-flash"}\n\n',
      'event: delta\ndata: {"text":"好的"}\n\n',
      'event: done\ndata: {"ms":3}\n\n',
    ])
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
        inputActions: { captureInsertion: () => ({}), insertText: () => true, setDraft: () => {} },
        useInput,
        useProjection: (key, select) => select({ next: { provider: 'newapi', model: 'deepseek-flash' } }),
      }),
    ))
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  await act(async () => { container.querySelector('.dx-launcher').click() })
  const card = container.querySelector('.dx-card')
  assert.ok(card !== null)
  assert.equal(card.querySelector('.dx-model').textContent.trim(), 'deepseek-flash')

  await act(async () => {
    setTextarea(card.querySelector('.dx-input'), '你好')
    card.querySelector('.dx-send').click()
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(requests[0].provider, 'newapi')
  assert.equal(requests[0].model, 'deepseek-flash')

  await act(async () => { root.unmount() })
  container.remove()
})

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
  assert.equal(requests[0].inheritContext, true, 'composer quick-ask inherits like a sub-session')
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

test('a selection in the right sidebar document preview carries the file path', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  assert.ok(overlay !== undefined)

  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: { enabled: true, showMeta: true, selectionMaxChars: 6000, inheritContext: true, presets: [], rightClick: true, autoAnswer: false, autoAnswer: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"p","model":"m","effort":"off"}\n\n',
      'event: delta\ndata: {"text":"好的"}\n\n',
      'event: done\ndata: {"ms":1}\n\n',
    ])
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })

  await act(async () => {
    root.render(React.createElement(overlay.component, { useSessions }))
  })

  const preview = document.createElement('div')
  preview.setAttribute('data-textpreview-state', 'text')
  const marker = document.createElement('span')
  marker.setAttribute('data-explainer-file-path', '/workspace/notes.md')
  marker.hidden = true
  const body = document.createElement('div')
  body.setAttribute('data-textpreview-body', '')
  const paragraph = document.createElement('p')
  paragraph.textContent = 'alpha beta gamma'
  body.appendChild(paragraph)
  preview.append(marker, body)
  document.body.appendChild(preview)

  await act(async () => {
    const range = document.createRange()
    range.setStart(paragraph.firstChild, 0)
    range.setEnd(paragraph.firstChild, 5)
    const selection = dom.window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    preview.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })

  const card = container.querySelector('.dx-card')
  assert.ok(card !== null, 'right-click in the preview opens the window')
  assert.equal(card.querySelector('.dx-file').textContent.trim(), 'notes.md')

  await act(async () => { setTextarea(card.querySelector('.dx-input'), '这段什么意思') })
  await act(async () => {
    card.querySelector('.dx-send').click()
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].filePath, '/workspace/notes.md')

  await act(async () => { root.unmount() })
  preview.remove()
  container.remove()
})

test('the document toolbar Ask action opens with the file and no quote', async () => {
  const registrations = harness()
  const action = registrations.find(item => item.options.id === 'explainer.file-context')
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  assert.ok(action !== undefined, 'the toolbar action is registered')
  assert.ok(overlay !== undefined)

  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: { enabled: true, showMeta: true, selectionMaxChars: 6000, inheritContext: true, presets: [], rightClick: true, autoAnswer: false, autoAnswer: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"p","model":"m","effort":"off"}\n\n',
      'event: delta\ndata: {"text":"好的"}\n\n',
      'event: done\ndata: {"ms":1}\n\n',
    ])
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })
  await act(async () => {
    root.render(React.createElement(React.Fragment, null,
      React.createElement(overlay.component, { useSessions }),
      React.createElement(action.component, { absolutePath: '/workspace/report.html' }),
    ))
  })

  const ask = container.querySelector('.dx-file-ask')
  assert.ok(ask !== null, 'the toolbar Ask button renders')
  await act(async () => { ask.click() })
  const card = container.querySelector('.dx-card')
  assert.ok(card !== null, 'the Ask button opens the window')
  assert.equal(card.querySelector('.dx-file').textContent.trim(), 'report.html')
  assert.equal(card.querySelector('.dx-quote'), null, 'no quote for the file-level ask')

  await act(async () => {
    card.querySelector('.dx-send').click()
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].filePath, '/workspace/report.html')
  assert.equal(requests[0].question, '')

  await act(async () => { root.unmount() })
  container.remove()
})

test('a selection in the better-sidebar editor resolves its tab path', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  assert.ok(overlay !== undefined)

  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: { enabled: true, showMeta: true, selectionMaxChars: 6000, inheritContext: true, presets: [], rightClick: true, autoAnswer: false, autoAnswer: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"p","model":"m","effort":"off"}\n\n',
      'event: delta\ndata: {"text":"好的"}\n\n',
      'event: done\ndata: {"ms":1}\n\n',
    ])
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })
  await act(async () => {
    root.render(React.createElement(overlay.component, { useSessions }))
  })

  // Mimic better-sidebar's editor pane: a path input in the header and a
  // CodeMirror-like contenteditable body.
  const pane = document.createElement('div')
  pane.setAttribute('data-dsh-pane', '')
  const header = document.createElement('div')
  const pathInput = document.createElement('input')
  pathInput.setAttribute('title', '/workspace/report.md')
  header.appendChild(pathInput)
  const body = document.createElement('div')
  body.setAttribute('contenteditable', 'true')
  body.textContent = 'alpha beta gamma'
  pane.append(header, body)
  document.body.appendChild(pane)

  await act(async () => {
    const range = document.createRange()
    range.setStart(body.firstChild, 0)
    range.setEnd(body.firstChild, 5)
    const selection = dom.window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    pane.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })

  const card = container.querySelector('.dx-card')
  assert.ok(card !== null, 'right-click in the editor opens the window')
  assert.equal(card.querySelector('.dx-file').textContent.trim(), 'report.md')

  await act(async () => { setTextarea(card.querySelector('.dx-input'), '这段什么意思') })
  await act(async () => {
    card.querySelector('.dx-send').click()
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].filePath, '/workspace/report.md')

  await act(async () => { root.unmount() })
  pane.remove()
  container.remove()
})

test('same-origin iframe selection opens the shared overlay and sends its parent-owned file path', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) return new Response(JSON.stringify({ ok: true, config: {
      enabled: true, selectionMaxChars: 6000, inheritContext: true, presets: [], rightClick: true, autoAnswer: false,
    } }), { status: 200 })
    requests.push(JSON.parse(init.body))
    return sse(['event: done\ndata: {"ms":1}\n\n'])
  }
  const preview = document.createElement('div')
  preview.setAttribute('data-textpreview-state', 'html')
  preview.innerHTML = '<span data-explainer-file-path="/workspace/embedded.html"></span><div data-textpreview-body><iframe></iframe></div>'
  document.body.appendChild(preview)
  const frame = preview.querySelector('iframe')
  const doc = frame.contentDocument
  doc.body.innerHTML = '<p>embedded selection</p>'
  doc.defaultView.Range.prototype.getClientRects = () => [RECT]
  frame.getBoundingClientRect = () => ({ left: 20, top: 10, right: 520, bottom: 410, width: 500, height: 400 })
  Object.defineProperty(frame, 'offsetWidth', { value: 500 })
  Object.defineProperty(frame, 'offsetHeight', { value: 400 })
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => { root.render(React.createElement(overlay.component, {
      useSessions: select => select({ byId: { s1: { retainedBy: { mainView: 1 } } } }),
    })) })
    await act(async () => {
      const range = doc.createRange(); range.selectNodeContents(doc.querySelector('p'))
      doc.defaultView.getSelection().addRange(range)
      doc.dispatchEvent(new doc.defaultView.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })
    const card = container.querySelector('.dx-card')
    assert.ok(card)
    assert.equal(card.querySelector('.dx-file').textContent.trim(), 'embedded.html')
    assert.match(card.querySelector('.dx-quote').textContent, /embedded selection/)
    assert.equal(requests.length, 0, 'opening is not an automatic provider request')
    await act(async () => { card.querySelector('.dx-send').click(); await new Promise(resolve => setTimeout(resolve, 30)) })
    assert.equal(requests[0].selection, 'embedded selection')
    assert.equal(requests[0].filePath, '/workspace/embedded.html')
  } finally {
    await act(async () => { root.unmount() })
    preview.remove(); container.remove()
  }
})

test('an English selection answers itself without pressing Enter', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: { enabled: true, showMeta: true, selectionMaxChars: 6000, inheritContext: true, presets: [], rightClick: true, autoAnswer: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"p","model":"m","effort":"off"}\n\n',
      'event: delta\ndata: {"text":"分支贵在合并。"}\n\n',
      'event: done\ndata: {"ms":1}\n\n',
    ])
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })
  await act(async () => {
    root.render(React.createElement(overlay.component, { useSessions }))
  })
  const chat = document.createElement('div')
  chat.setAttribute('data-slot', 'conversation.chat.flow')
  chat.textContent = 'The cost of a branch is mostly in merging, not in creating it.'
  document.body.appendChild(chat)
  await act(async () => {
    const range = document.createRange()
    range.selectNodeContents(chat)
    const selection = dom.window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    chat.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  assert.ok(container.querySelector('.dx-card') !== null, 'the window opens')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)) })
  assert.equal(requests.length, 1, 'the default answer starts by itself')
  assert.equal(requests[0].question, '', 'no question was typed')
  assert.match(requests[0].selection, /cost of a branch/)
  const bubble = container.querySelector('.dx-turn-user, .dx-body')
  assert.ok(bubble !== null)
  await act(async () => { root.unmount() })
  chat.remove()
  container.remove()
})

test('typing before the automatic answer cancels it', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: { enabled: true, showMeta: true, selectionMaxChars: 6000, inheritContext: true, presets: [], rightClick: true, autoAnswer: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"p","model":"m","effort":"off"}\n\n',
      'event: delta\ndata: {"text":"好"}\n\n',
      'event: done\ndata: {"ms":1}\n\n',
    ])
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })
  await act(async () => {
    root.render(React.createElement(overlay.component, { useSessions }))
  })
  const chat = document.createElement('div')
  chat.setAttribute('data-slot', 'conversation.chat.flow')
  chat.textContent = 'The cost of a branch is mostly in merging, not in creating it.'
  document.body.appendChild(chat)
  await act(async () => {
    const range = document.createRange()
    range.selectNodeContents(chat)
    const selection = dom.window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    chat.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  const input = container.querySelector('.dx-input')
  await act(async () => { setTextarea(input, '这句话重点是什么？') })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)) })
  assert.equal(requests.length, 0, 'typing cancels the automatic answer')
  await act(async () => {
    container.querySelector('.dx-send').click()
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].question, '这句话重点是什么？')
  await act(async () => { root.unmount() })
  chat.remove()
  container.remove()
})

test('the window waits for the config before pinning the model', async () => {
  const registrations = harness()
  const overlay = registrations.find(item => item.options.id === 'explainer.window')
  const requests = []
  dom.window.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return new Response(JSON.stringify({ ok: true, config: {
        enabled: true, showMeta: true, selectionMaxChars: 6000, inheritContext: true,
        presets: [], rightClick: true, autoAnswer: true,
        defaultModel: { provider: 'newapi-gemini', model: 'gemini-3.8-flash' },
        pinnedModel: { provider: 'newapi-gemini', model: 'gemini-3.8-flash' },
        modelGroups: [
          { id: 'newapi', name: '公司', models: [{ id: 'deepseek-flash', name: 'deepseek-flash' }] },
          { id: 'newapi-gemini', name: 'Gemini', models: [{ id: 'gemini-3.8-flash', name: 'gemini-3.8-flash' }] },
        ],
      } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    requests.push(JSON.parse(init.body))
    return sse([
      'event: meta\ndata: {"provider":"newapi-gemini","model":"gemini-3.8-flash","effort":"low"}\n\n',
      'event: delta\ndata: {"text":"好"}\n\n',
      'event: done\ndata: {"ms":1}\n\n',
    ])
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const useSessions = (select) => select({ byId: { s1: { retainedBy: { mainView: 1 } } } })
  await act(async () => { root.render(React.createElement(overlay.component, { useSessions })) })
  const chat = document.createElement('div')
  chat.setAttribute('data-slot', 'conversation.chat.flow')
  chat.textContent = 'The cost of a branch is mostly in merging.'
  document.body.appendChild(chat)
  await act(async () => {
    const range = document.createRange()
    range.selectNodeContents(chat)
    const selection = dom.window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    chat.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 950)) })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].provider, 'newapi-gemini', 'the pin wins over the inherited main model')
  assert.equal(requests[0].model, 'gemini-3.8-flash')
  await act(async () => { root.unmount() })
  chat.remove()
  container.remove()
})
