/** Isolated fixture, not a replacement DSH server. Run after npm run build. */
import assert from 'node:assert/strict'
import { readFile, mkdtemp, realpath, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { spawn } from 'node:child_process'

const chrome = process.env.EXPLAINER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
// The fixture injects these modules into a template literal; escape the
// backticks and ${...} that appear in their comments.
const escape = (source) => source.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
const selection = await readFile(new URL('../lib/client-build/selection.cjs', import.meta.url), 'utf8')
const frames = await readFile(new URL('../lib/client-build/preview-frames.cjs', import.meta.url), 'utf8')
const b64 = (source) => Buffer.from(source, 'utf8').toString('base64')
const script = `
(async () => {
  const selection = {};
  new Function('exports', atob(${JSON.stringify(b64(selection))}))(selection);
  const bridge = {};
  new Function('exports', 'require', atob(${JSON.stringify(b64(frames))}))(bridge, () => selection);
  const normal = document.querySelector('#normal'), opaque = document.querySelector('#opaque');
  await Promise.all([normal, opaque].map(frame => new Promise(resolve => {
    frame.onload = resolve; frame.srcdoc = '<p>hello preview selection</p>';
  })));
  const opened = [], hints = [];
  const dispose = bridge.observePreviewFrames(document, {
    hint: v => hints.push(v), open: v => opened.push(v), pointerDown() {},
    enabled: () => true, rightClick: () => true, escape() {},
  });
  const doc = normal.contentDocument;
  const range = doc.createRange(); range.selectNodeContents(doc.querySelector('p'));
  doc.defaultView.getSelection().addRange(range);
  doc.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  const sameOrigin = opened.length === 1 && opened[0].text === 'hello preview selection'
    && opened[0].filePath === '/workspace/report.html' && opened[0].rect.left > 0;
  let denied = false;
  try { opaque.contentWindow.getSelection(); } catch (error) { denied = error.name === 'SecurityError'; }
  window.dispatchEvent(new MessageEvent('message', { origin: 'null', source: opaque.contentWindow,
    data: { type: 'explainer-selection', text: 'forged', filePath: '/private/key' } }));
  const ignored = opened.length === 1;
  dispose(); doc.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  const result = { sameOrigin, opaqueDocument: opaque.contentDocument === null,
    opaqueDenied: denied, opaqueBridge: bridge.accessiblePreviewDocument(opaque) === null,
    sandboxUnchanged: opaque.getAttribute('sandbox') === 'allow-scripts',
    messageIgnored: ignored, disposed: opened.length === 1 };
  document.querySelector('#result').textContent = JSON.stringify(result);
})().catch(error => { document.querySelector('#result').textContent = JSON.stringify({ error: String(error) }); });
`
const html = `<!doctype html><html><body>
<div data-textpreview-state="html"><span data-explainer-file-path="/workspace/report.html"></span>
<div data-textpreview-body><iframe id="normal"></iframe><iframe id="opaque" sandbox="allow-scripts"></iframe></div></div>
<pre id="result">pending</pre><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
const server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html) })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const profile = await mkdtemp(join(tmpdir(), 'explainer-frame-test-'))
let child
try {
  const { port } = server.address()
  child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
    '--dump-dom', '--virtual-time-budget=3000', `http://127.0.0.1:${port}/`], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  const timer = setTimeout(() => child.kill(), 30000)
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
    assert.equal(code, 0, stderr)
    const match = stdout.match(/<pre id="result">([^<]+)<\/pre>/)
    assert.ok(match, 'browser fixture did not report a result')
    const result = JSON.parse(match[1])
    assert.equal(Object.keys(result).length, 7, JSON.stringify(result))
    for (const [key, value] of Object.entries(result)) assert.equal(value, true, key)
    console.log('Chromium preview boundary: PASS', result)
  } finally { clearTimeout(timer) }
} finally {
  child?.kill()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  // Delete only the exact temporary test profile created above, after resolving it.
  const target = await realpath(profile)
  assert.equal(dirname(target), await realpath(tmpdir()))
  assert.ok(basename(target).startsWith('explainer-frame-test-'))
  await rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 })
}
