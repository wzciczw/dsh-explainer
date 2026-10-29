/**
 * Real-browser proof against the user's own report: the rendered document
 * keeps its scripts/figures and the bridge reports selections from it.
 *
 * The page loads the document twice:
 *  - `live`, same-origin (no sandbox) so the fixture can drive a selection;
 *  - `opaque`, sandbox="allow-scripts", to prove the shipped frame stays
 *    cross-origin.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { loadBundleModule } from '../test/bundle-modules.mjs'

const CHROME = process.env.EXPLAINER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const bridge = loadBundleModule('html-bridge')
const channel = 'c'.repeat(40)
const report = await readFile('D:/agent-research/outputs/research/2026-10-29_observability_survey/report.html', 'utf8')
const documentHtml = bridge.buildBridgeDocument(report, channel)

const page = `<!doctype html><html><body>
<iframe id="live" style="width:900px;height:600px"></iframe>
<iframe id="opaque" sandbox="allow-scripts" style="width:400px;height:300px"></iframe>
<pre id="result">pending</pre>
<script>
(async () => {
  const live = document.querySelector('#live');
  const opaque = document.querySelector('#opaque');
  const messages = [];
  window.addEventListener('message', event => {
    if (event.source === live.contentWindow) messages.push(event.data);
  });
  live.src = '/report.html';
  opaque.src = '/report.html';
  await new Promise(resolve => { live.onload = resolve; });
  await new Promise(resolve => setTimeout(resolve, 800));
  const doc = live.contentDocument;
  const figures = doc.querySelectorAll('figure').length;
  const heading = doc.querySelector('h1')?.textContent ?? '';
  const target = doc.querySelector('h1').firstChild;
  const range = doc.createRange();
  range.setStart(target, 0);
  range.setEnd(target, Math.min(4, target.textContent.length));
  doc.defaultView.getSelection().removeAllRanges();
  doc.defaultView.getSelection().addRange(range);
  doc.dispatchEvent(new doc.defaultView.Event('pointerup', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 250));
  const hint = messages.find(item => item && item.action === 'hint');
  doc.dispatchEvent(new doc.defaultView.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 120));
  document.querySelector('#result').textContent = JSON.stringify({
    heading,
    figures,
    opaque: opaque.contentDocument === null,
    hasHint: Boolean(hint),
    text: hint ? hint.text : '',
    channel: hint ? hint.channel === ${JSON.stringify(channel)} : false,
    opened: messages.some(item => item && item.action === 'open'),
  });
})().catch(error => { document.querySelector('#result').textContent = JSON.stringify({ error: String(error) }); });
</script></body></html>`

const server = createServer((req, res) => {
  if (req.url === '/report.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(documentHtml)
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(page)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const profile = await mkdtemp(join(tmpdir(), 'explainer-report-'))
let child
try {
  const { port } = server.address()
  child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
    '--dump-dom', '--virtual-time-budget=8000', `http://127.0.0.1:${port}/`], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
  assert.equal(code, 0, stderr)
  const match = stdout.match(/<pre id="result">([^<]+)<\/pre>/)
  assert.ok(match, 'the fixture reported nothing')
  const result = JSON.parse(match[1])
  console.log('detail:', JSON.stringify({ heading: result.heading, figures: result.figures, opaque: result.opaque, hasHint: result.hasHint, text: result.text, opened: result.opened }))
  assert.equal(result.opaque, true, 'the shipped frame is opaque')
  assert.equal(result.hasHint, true, 'the rendered report bridged a selection')
  assert.equal(result.opened, true, 'right-click opened')
  assert.equal(result.heading, '多智能体与长时程系统的可观测性', 'the report rendered its heading')
  console.log('Chromium rendered-report bridge: PASS')
} finally {
  child?.kill()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  const target = await realpath(profile)
  assert.equal(dirname(target), await realpath(tmpdir()))
  assert.ok(basename(target).startsWith('explainer-report-'))
  await rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 })
}
