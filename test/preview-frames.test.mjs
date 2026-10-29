import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { JSDOM } from 'jsdom'
const require = createRequire(import.meta.url)
// Client build uses extensionless requires; load its sibling CommonJS modules.
const Module = require('node:module')
const original = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...args) {
  if (parent?.filename.includes('client-build') && request.startsWith('./')) request += '.cjs'
  return original.call(this, request, parent, ...args)
}
const { accessiblePreviewDocument, previewRect, observePreviewFrames } = require('../lib/client-build/preview-frames.cjs')
Module._resolveFilename = original

function fixture({ sandbox, recognized = true } = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://dsh.test/' })
  const { window } = dom
  global.MutationObserver = window.MutationObserver
  const root = window.document.createElement('div')
  root.setAttribute('data-textpreview-state', 'html')
  root.innerHTML = '<span data-explainer-file-path="/workspace/report.html"></span><div data-textpreview-body><iframe></iframe></div>'
  if (!recognized) root.querySelector('span').remove()
  const frame = root.querySelector('iframe')
  if (sandbox !== undefined) frame.setAttribute('sandbox', sandbox)
  window.document.body.append(root)
  frame.getBoundingClientRect = () => ({ left: 100, top: 60, right: 500, bottom: 360, width: 400, height: 300 })
  for (const [key, value] of Object.entries({ offsetWidth: 200, offsetHeight: 150, clientLeft: 2, clientTop: 3 })) {
    Object.defineProperty(frame, key, { configurable: true, value })
  }
  const doc = frame.contentDocument
  doc.body.innerHTML = '<p>alpha beta gamma</p><textarea>secret draft</textarea>'
  doc.defaultView.Range.prototype.getClientRects = () => [{ left: 10, top: 20, right: 70, bottom: 30, width: 60, height: 10 }]
  function select(node = doc.querySelector('p').firstChild) {
    const range = doc.createRange()
    range.selectNodeContents(node)
    const selection = doc.defaultView.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }
  const hints = [], opened = []
  let down = 0, escape = 0, enabled = true, rightClick = true
  const dispose = observePreviewFrames(window.document, {
    hint: value => hints.push(value), open: value => opened.push(value),
    pointerDown: () => down++, escape: () => escape++, enabled: () => enabled, rightClick: () => rightClick,
  })
  function event(type, data = {}) {
    const C = type === 'keydown' ? doc.defaultView.KeyboardEvent : doc.defaultView.MouseEvent
    const e = new C(type, { bubbles: true, cancelable: true, ...data })
    doc.dispatchEvent(e)
    return e
  }
  return { dom, window, doc, root, frame, select, event, hints, opened, dispose,
    disable: () => { enabled = false }, noRightClick: () => { rightClick = false },
    get down() { return down }, get escape() { return escape },
    close() { dispose(); window.close() },
  }
}
const tick = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms))

test('same-origin preview selection opens only in response to user UI and maps scaled coordinates', async () => {
  const f = fixture()
  try {
    f.select()
    f.event('pointerup')
    await tick(200)
    const found = f.hints.at(-1)
    assert.equal(found.text, 'alpha beta gamma')
    assert.equal(found.filePath, '/workspace/report.html')
    assert.deepEqual(found.rect, { left: 124, top: 106, right: 244, bottom: 126, width: 120, height: 20 })
    assert.equal(f.opened.length, 0, 'selection alone never starts a request or opens a card')
    assert.equal(f.event('contextmenu').defaultPrevented, true)
    assert.equal(f.opened.length, 1)
    f.event('keydown', { key: 'E', ctrlKey: true, shiftKey: true })
    assert.equal(f.opened.length, 2)
    f.event('keydown', { key: 'Escape' })
    assert.equal(f.escape, 1)
    f.event('pointerdown')
    assert.equal(f.down, 1)
  } finally { f.close() }
})

for (const sandbox of ['', 'allow-scripts', 'allow-scripts allow-forms']) {
  test(`opaque sandbox is rejected before accessing its document: ${sandbox}`, () => {
    const f = fixture({ sandbox })
    try {
      let reads = 0
      Object.defineProperty(f.frame, 'contentDocument', { configurable: true, get() { reads++; throw new Error('SOP') } })
      assert.equal(accessiblePreviewDocument(f.frame), null)
      f.select(); f.event('contextmenu')
      assert.equal(reads, 0)
      assert.equal(f.opened.length, 0)
      assert.equal(f.frame.getAttribute('sandbox'), sandbox)
      assert.equal(f.frame.hasAttribute('srcdoc'), false)
    } finally { f.close() }
  })
}

test('unrecognized frames and cross-origin documents fail closed', () => {
  const f = fixture({ recognized: false })
  try {
    f.select(); f.event('contextmenu')
    assert.equal(f.opened.length, 0)
    assert.equal(accessiblePreviewDocument(f.frame), null)
    f.root.insertAdjacentHTML('afterbegin', '<span data-explainer-file-path="/workspace/report.html"></span>')
    Object.defineProperty(f.frame, 'contentDocument', { get() { throw new Error('SecurityError') } })
    assert.equal(accessiblePreviewDocument(f.frame), null)
  } finally { f.close() }
})

test('same-origin sandbox remains intact and editable controls are excluded', () => {
  const f = fixture({ sandbox: 'allow-same-origin' })
  try {
    f.select(); f.event('contextmenu')
    assert.equal(f.opened.length, 1)
    f.select(f.doc.querySelector('textarea').firstChild)
    assert.equal(f.event('contextmenu').defaultPrevented, false)
    assert.equal(f.opened.length, 1)
    assert.equal(f.frame.getAttribute('sandbox'), 'allow-same-origin')
  } finally { f.close() }
})

test('right-click and enabled settings are respected', async () => {
  const f = fixture()
  try {
    f.select(); f.noRightClick()
    assert.equal(f.event('contextmenu').defaultPrevented, false)
    f.event('keydown', { key: 'e', metaKey: true, shiftKey: true })
    assert.equal(f.opened.length, 1)
    f.disable(); f.event('pointerup'); await tick()
    assert.equal(f.hints.at(-1), null)
    f.event('keydown', { key: 'e', metaKey: true, shiftKey: true })
    assert.equal(f.opened.length, 1)
  } finally { f.close() }
})

test('removal and disposal revoke listeners and pending selection timers', async () => {
  const f = fixture()
  try {
    f.select(); f.event('pointerup'); f.dispose()
    const count = f.hints.length
    await tick()
    f.event('contextmenu')
    assert.equal(f.hints.length, count)
    assert.equal(f.opened.length, 0)
  } finally { f.close() }
  const g = fixture()
  try {
    g.select(); g.root.remove(); await tick()
    g.event('contextmenu')
    assert.equal(g.opened.length, 0)
    assert.equal(g.hints.at(-1), null)
  } finally { g.close() }
})

test('sandbox changes revoke an existing binding immediately and after observer cleanup', async () => {
  const f = fixture()
  try {
    f.select(); f.frame.setAttribute('sandbox', 'allow-scripts')
    f.event('contextmenu')
    assert.equal(f.opened.length, 0)
    await tick()
    f.event('contextmenu')
    assert.equal(f.opened.length, 0)
    f.frame.removeAttribute('sandbox'); await tick()
    f.event('contextmenu')
    assert.equal(f.opened.length, 1)
  } finally { f.close() }
})

test('file paths are derived from the current parent marker, never iframe content or messages', async () => {
  const f = fixture()
  try {
    f.select()
    f.doc.body.insertAdjacentHTML('beforeend', '<span data-explainer-file-path="/private/key"></span>')
    f.window.dispatchEvent(new f.window.MessageEvent('message', { origin: 'null', source: f.frame.contentWindow,
      data: { type: 'explainer-selection', text: 'forged', filePath: '/private/key' } }))
    assert.equal(f.opened.length, 0)
    f.root.querySelector('span').setAttribute('data-explainer-file-path', '/workspace/next.html')
    f.event('contextmenu')
    assert.equal(f.opened[0].filePath, '/workspace/next.html')
  } finally { f.close() }
})

test('hidden or offscreen geometry is rejected', () => {
  const f = fixture()
  try {
    Object.defineProperty(f.frame, 'offsetWidth', { value: 0 })
    assert.equal(previewRect(f.frame, { left: 1, top: 1, right: 3, bottom: 3, width: 2, height: 2 }), null)
    f.select(); f.event('contextmenu')
    assert.equal(f.opened.length, 0)
  } finally { f.close() }
})

test('load replaces document listeners; changing the file marker invalidates a stale pill', async () => {
  const f = fixture()
  const replacement = new JSDOM('<p>replacement</p>', { url: 'https://dsh.test/' })
  try {
    f.select(); f.event('pointerup'); await tick(200)
    assert.ok(f.hints.at(-1))
    f.root.querySelector('span').setAttribute('data-explainer-file-path', '/workspace/new.html')
    await tick()
    assert.equal(f.hints.at(-1), null)
    Object.defineProperty(f.frame, 'contentDocument', { configurable: true, value: replacement.window.document })
    f.frame.dispatchEvent(new f.window.Event('load'))
    f.event('contextmenu')
    assert.equal(f.opened.length, 0, 'the old document has no handler')
    const doc = replacement.window.document
    doc.defaultView.Range.prototype.getClientRects = () => [{ left: 10, top: 20, right: 70, bottom: 30, width: 60, height: 10 }]
    const range = doc.createRange(); range.selectNodeContents(doc.querySelector('p'))
    doc.defaultView.getSelection().addRange(range)
    doc.dispatchEvent(new doc.defaultView.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    assert.equal(f.opened.length, 1)
    assert.equal(f.opened[0].text, 'replacement')
    assert.equal(f.opened[0].filePath, '/workspace/new.html')
  } finally { f.close(); replacement.window.close() }
})

test('a dynamically added preview binds once and resizing clears its stale anchor', async () => {
  const f = fixture({ recognized: false })
  try {
    f.root.insertAdjacentHTML('afterbegin', '<span data-explainer-file-path="/workspace/dynamic.html"></span>')
    await tick()
    f.select(); f.event('contextmenu')
    assert.equal(f.opened.length, 1)
    f.window.dispatchEvent(new f.window.Event('resize'))
    assert.equal(f.hints.at(-1), null)
    f.event('contextmenu')
    assert.equal(f.opened.length, 2, 'a rescan does not duplicate handlers')
  } finally { f.close() }
})
