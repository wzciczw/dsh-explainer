import assert from 'node:assert/strict'
import test from 'node:test'
import { loadBundleModule } from './bundle-modules.mjs'

globalThis.window = { innerWidth: 1920, innerHeight: 1080 }
const receiver = loadBundleModule('html-receiver')

function harness(overrides = {}) {
  const listeners = []
  const owner = {
    defaultView: {
      addEventListener: (type, fn) => listeners.push({ type, fn }),
      removeEventListener: (type, fn) => {
        const index = listeners.findIndex(entry => entry.type === type && entry.fn === fn)
        if (index >= 0) listeners.splice(index, 1)
      },
    },
  }
  const contentWindow = { tag: 'child' }
  const frame = {
    ownerDocument: owner,
    isConnected: true,
    contentWindow,
    clientWidth: 600,
    clientHeight: 400,
    getBoundingClientRect: () => ({ left: 100, top: 50, right: 700, bottom: 450, width: 600, height: 400 }),
    offsetWidth: 600,
    offsetHeight: 400,
    clientLeft: 0,
    clientTop: 0,
  }
  const calls = { hint: [], open: [], outside: 0, escape: 0 }
  const dispose = receiver.bindHtmlBridge(frame, 'channel-1', '/w/report.html', {
    hint: value => calls.hint.push(value),
    open: value => calls.open.push(value),
    outside: () => { calls.outside += 1 },
    escape: () => { calls.escape += 1 },
    enabled: () => overrides.enabled ?? true,
    rightClick: () => overrides.rightClick ?? true,
  })
  const dispatch = (data, from = contentWindow) => {
    for (const entry of listeners) if (entry.type === 'message') entry.fn({ data, source: from })
  }
  return { calls, listeners, dispose, dispatch }
}

const envelope = (extra) => ({ type: 'dsh-explainer/html-selection/v1', channel: 'channel-1', sequence: 1, ...extra })
const selection = { text: 'hello world', rect: { left: 10, top: 10, right: 110, bottom: 30 } }

test('a valid hint maps into page coordinates with the parent-owned path', () => {
  const h = harness()
  h.dispatch(envelope({ action: 'hint', ...selection }))
  assert.equal(h.calls.hint.length, 1)
  assert.equal(h.calls.hint[0].text, 'hello world')
  assert.equal(h.calls.hint[0].filePath, '/w/report.html')
  assert.equal(h.calls.hint[0].rect.left, 110)
  assert.equal(h.calls.hint[0].rect.top, 60)
  h.dispose()
})

test('foreign source, channel, replay and untrusted payloads are ignored', () => {
  const h = harness()
  h.dispatch(envelope({ action: 'hint', ...selection }), { tag: 'other' })
  h.dispatch(envelope({ action: 'hint', ...selection, channel: 'other' }))
  assert.equal(h.calls.hint.length, 0)
  h.dispatch(envelope({ action: 'hint', ...selection }))
  h.dispatch(envelope({ action: 'hint', ...selection, text: 'again' }))
  assert.equal(h.calls.hint.length, 1)
  assert.equal(h.calls.hint[0].text, 'hello world')
  let sequence = 10
  for (const bad of [
    { text: 'x', rect: selection.rect },
    { text: 'a'.repeat(7000), rect: selection.rect },
    { text: 'ok', rect: { left: 10, top: 10, right: -5, bottom: 30 } },
    { text: 'ok', rect: { left: 10, top: 10, right: 900, bottom: 30 } },
    { text: 42, rect: selection.rect },
  ]) h.dispatch(envelope({ action: 'hint', sequence: sequence += 1, ...bad }))
  assert.equal(h.calls.hint.length, 1)
  h.dispose()
})

test('the message rate is capped', () => {
  const h = harness()
  for (let index = 1; index <= 200; index += 1) h.dispatch(envelope({ action: 'hint', sequence: index, ...selection }))
  assert.ok(h.calls.hint.length <= 41, `delivered ${h.calls.hint.length}`)
  h.dispose()
})

test('settings, outside clicks, escape and disposal are honoured', () => {
  const off = harness({ rightClick: false })
  off.dispatch(envelope({ action: 'open', ...selection }))
  assert.equal(off.calls.open.length, 0)
  off.dispose()

  const disabled = harness({ enabled: false })
  disabled.dispatch(envelope({ action: 'hint', ...selection }))
  assert.equal(disabled.calls.hint.length, 0)
  disabled.dispose()

  const h = harness()
  h.dispatch(envelope({ action: 'outside', sequence: 1 }))
  h.dispatch(envelope({ action: 'escape', sequence: 2 }))
  assert.equal(h.calls.outside, 1)
  assert.equal(h.calls.escape, 1)
  h.dispose()
  assert.equal(h.listeners.length, 0, 'every listener was removed')
  h.dispatch(envelope({ action: 'open', sequence: 3, ...selection }))
  assert.equal(h.calls.open.length, 0)
})
