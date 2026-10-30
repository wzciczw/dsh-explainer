/**
 * Portable proof of the interactive-diagram selection mode.
 *
 * The fixture's diagram prevents the default pointerdown (as pan/zoom pages
 * do). Without selection mode the drag cannot create a selection; with the
 * mode toggle, or while Alt is held, the bridge stops the page handler and
 * the browser selects normally.
 */
import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { loadBundleModule } from '../test/bundle-modules.mjs'

const CHROME = process.env.EXPLAINER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const fixture = `<!doctype html><html><body style="margin:0">
<div id="diagram" style="width:700px;height:300px">
  <svg width="700" height="300" viewBox="0 0 700 300">
    <text id="label" x="80" y="120" style="font-size:28px;fill:#111">interactive diagram label</text>
  </svg>
</div>
<script>
  document.getElementById('diagram').addEventListener('pointerdown', function (event) {
    window.__panning = true
    event.preventDefault()
  })
</script></body></html>`
const documentHtml = loadBundleModule('html-bridge').buildBridgeDocument(fixture, 'a'.repeat(40))

const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(documentHtml) })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const profile = await mkdtemp(join(tmpdir(), 'explainer-interactive-'))
const debugPort = 9342
let child
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  const { port } = server.address()
  child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debugPort}`, `http://127.0.0.1:${port}/`], { stdio: ['ignore', 'pipe', 'pipe'] })
  let targets
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); if (targets.length > 0) break } catch {}
    await sleep(250)
  }
  const target = targets.find(item => item.type === 'page') ?? targets[0]
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let id = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
  }
  const send = (method, params = {}) => new Promise(resolve => {
    const next = ++id
    pending.set(next, resolve)
    socket.send(JSON.stringify({ id: next, method, params }))
  })
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
  await sleep(1200)
  const rect = await evaluate(`(() => {
    const text = document.getElementById('label')
    const range = document.createRange(); range.selectNodeContents(text)
    const r = range.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })()`)
  assert.ok(rect.w > 20, 'the fixture text is visible')
  const x = Math.round(rect.x + 4)
  const y = Math.round(rect.y + rect.h / 2)
  const drag = async (modifiers = 0) => {
    await evaluate('getSelection().removeAllRanges()')
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, modifiers, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 60, y, button: 'left', buttons: 1, modifiers })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 60, y, button: 'left', buttons: 0, modifiers, clickCount: 1 })
    await sleep(150)
    return evaluate('String(getSelection())')
  }

  const withoutMode = await drag()
  assert.equal(withoutMode, '', 'the page handler blocks selection without the mode')

  await evaluate(`window.postMessage({ type: 'dsh-explainer/selection-mode', enabled: true }, '*')`)
  await sleep(150)
  const withMode = await drag()
  assert.ok(withMode.length > 0, 'selection mode allows native text selection')

  await evaluate(`window.postMessage({ type: 'dsh-explainer/selection-mode', enabled: false }, '*')`)
  await sleep(150)
  const withAlt = await drag(1)
  assert.ok(withAlt.length > 0, 'Alt/Option is the keyboard shortcut')
  console.log('Chromium interactive selection: PASS', { withoutMode, withMode, withAlt })
  socket.close()
} finally {
  child?.kill()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  const target = await realpath(profile)
  assert.equal(dirname(target), await realpath(tmpdir()))
  assert.ok(basename(target).startsWith('explainer-interactive-'))
  await rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 })
}
