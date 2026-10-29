/**
 * Real-browser E2E for the 快问 plugin.
 *
 * Drives headless Chrome over CDP against the test instance (port 3097) and
 * the deterministic "fake" model, so it verifies the actual slot composition,
 * CSS injection, SSE parsing and streaming DOM updates.
 */
const BASE = process.env.EXPLAINER_BASE ?? 'http://127.0.0.1:3097'
const TOKEN = process.env.EXPLAINER_TOKEN ?? ''
const CDP = process.env.EXPLAINER_CDP ?? 'http://127.0.0.1:9223'

const targets = await (await fetch(`${CDP}/json/list`)).json()
const page = targets.find(target => target.type === 'page')
if (page === undefined) throw new Error('no page target')

const socket = new WebSocket(page.webSocketDebuggerUrl)
let nextId = 0
const pending = new Map()
const errors = []

socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id !== undefined) {
    const resolve = pending.get(message.id)
    if (resolve !== undefined) {
      pending.delete(message.id)
      resolve(message)
    }
    return
  }
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails?.exception?.description ?? 'exception')
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args?.map(arg => arg.value ?? arg.description ?? '').join(' '))
  }
}

await new Promise((resolve, reject) => {
  socket.onopen = resolve
  socket.onerror = reject
})

function send(method, params = {}) {
  const id = ++nextId
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise(resolve => pending.set(id, resolve))
}

async function evaluate(expression) {
  const reply = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  })
  if (reply.result?.exceptionDetails !== undefined) {
    throw new Error(reply.result.exceptionDetails.exception?.description ?? 'evaluate failed')
  }
  return reply.result?.result?.value
}

async function waitFor(expression, label, timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(expression)
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  const text = await evaluate('document.body.innerText.slice(0, 600)')
  throw new Error(`timed out waiting for ${label}; body: ${text}`)
}

const setInput = (value) => `(() => {
  const el = document.querySelector('.dx-card .dx-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return el.value;
})()`

const ANSWER_SELECTOR = ".dx-turn[data-role='assistant'] .dx-md"
const answersExpr = (index) => `[...document.querySelectorAll("${ANSWER_SELECTOR}")][${index}]?.textContent ?? ''`

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: `${BASE}/?token=${TOKEN}` })

await waitFor("document.querySelector('.dx-launcher') !== null", 'composer launcher')
console.log('launcher:', await evaluate("document.querySelector('.dx-launcher').textContent"))

await evaluate("document.querySelector('.dx-launcher').click()")
await waitFor("document.querySelector('.dx-card') !== null", 'quick-ask window')

const typed = await evaluate(setInput('解释一下分支成本'))
if (typed !== '解释一下分支成本') throw new Error(`typing failed: ${typed}`)

await evaluate("document.querySelector('.dx-card .dx-send').click()")
await waitFor(`(${answersExpr(0)}).includes('（fake）收到')`, 'first answer')
console.log('answer 1:', (await evaluate(answersExpr(0))).slice(0, 70))

await evaluate(setInput('那 merge 呢'))
await evaluate("document.querySelector('.dx-card .dx-send').click()")
await waitFor(`document.querySelectorAll("${ANSWER_SELECTOR}").length === 2`, 'follow-up answer')
await waitFor(`(${answersExpr(1)}).includes('那 merge 呢')`, 'follow-up content')

const summary = await evaluate(`(() => {
  const card = document.querySelector('.dx-card');
  return {
    turns: card.querySelectorAll('.dx-turn').length,
    answers: [...card.querySelectorAll("${ANSWER_SELECTOR}")].map(node => node.textContent),
    meta: card.querySelector('.dx-meta')?.textContent ?? '',
    quote: card.querySelector('.dx-quote')?.textContent ?? null,
    sendDisabled: card.querySelector('.dx-send').disabled,
  };
})()`)
console.log('summary:', JSON.stringify({ turns: summary.turns, answers: summary.answers.length, meta: summary.meta }))

await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
await new Promise(resolve => setTimeout(resolve, 250))
const closed = await evaluate("document.querySelector('.dx-card') === null && document.querySelector('.dx-restore') === null")
console.log('Escape closed the window:', closed)

// --- right-click on a selection opens the window directly ---
const prevented = await evaluate(`(() => {
  const host = document.createElement('div');
  host.setAttribute('data-slot', 'conversation.chat.flow');
  host.style.cssText = 'position:fixed;left:340px;top:380px;width:440px;height:100px;padding:12px;background:#1b1e23;color:#e7e9ee;z-index:6;border-radius:8px;font-size:14px;line-height:1.6';
  host.innerHTML = '<p id="dx-ctx-target">右键这段文字应该直接弹出问一下。</p>';
  document.body.appendChild(host);
  const node = document.getElementById('dx-ctx-target').firstChild;
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, 10);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  node.parentElement.dispatchEvent(event);
  return event.defaultPrevented;
})()`)
await waitFor("document.querySelector('.dx-card') !== null", 'right-click window')
const rightQuote = await evaluate("document.querySelector('.dx-quote').textContent")
console.log('right-click opened:', prevented, '|', rightQuote)
await evaluate("document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))")
await new Promise(resolve => setTimeout(resolve, 200))
await evaluate("window.getSelection().removeAllRanges()")
await new Promise(resolve => setTimeout(resolve, 250))

// --- selection mode in a real layout ---
const selected = await evaluate(`(() => {
  const host = document.createElement('div');
  host.setAttribute('data-slot', 'conversation.chat.flow');
  host.style.cssText = 'position:fixed;left:340px;top:220px;width:440px;height:120px;padding:12px;background:#1b1e23;color:#e7e9ee;z-index:5;border-radius:8px;font-size:14px;line-height:1.6';
  host.innerHTML = '<p id="dx-sel-target">LayerFS 的 Branch 创建很便宜，合并才贵。</p>';
  document.body.appendChild(host);
  const node = document.getElementById('dx-sel-target').firstChild;
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, 20);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  return selection.toString();
})()`)
console.log('selected text:', selected)
// Let the debounced selectionchange publish the new hint before clicking it.
await new Promise(resolve => setTimeout(resolve, 300))
await waitFor("document.querySelector('.dx-pill') !== null", 'selection pill')
console.log('pill:', await evaluate("document.querySelector('.dx-pill').textContent"))
await evaluate("document.querySelector('.dx-pill').click()")
await waitFor("document.querySelector('.dx-quote') !== null", 'selection window')
const quote = await evaluate("document.querySelector('.dx-quote').textContent")
console.log('quote:', quote)
const chrome = await evaluate(`({
  footer: document.querySelector('.dx-quote-foot') !== null,
  inheritBadge: [...document.querySelectorAll('.dx-badge')].some(node => node.textContent.includes('inherit')),
})`)
console.log('selection chrome:', JSON.stringify(chrome))
await evaluate(setInput('这句话重点是什么'))
await evaluate("document.querySelector('.dx-card .dx-send').click()")
await waitFor(`(${answersExpr(0)}).includes('用户选中的文字')`, 'selection answer')
const selectionAnswer = await evaluate(answersExpr(0))
console.log('selection answer:', selectionAnswer.slice(0, 100))

await evaluate("document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))")
await new Promise(resolve => setTimeout(resolve, 250))
const closedByOutside = await evaluate("document.querySelector('.dx-card') === null")
console.log('outside click closed the window:', closedByOutside)

if (errors.length > 0) console.log('console errors:', JSON.stringify(errors.slice(0, 5)))
socket.close()

if (summary.turns !== 4) throw new Error(`expected 4 turns, got ${summary.turns}`)
if (!summary.answers[0].includes('（fake）收到')) throw new Error('answer 1 missing fake reply')
if (!summary.answers[1].includes('那 merge 呢')) throw new Error('follow-up kept the wrong context')
if (!quote.includes('Branch')) throw new Error('selection quote missing: ' + quote)
if (chrome.footer) throw new Error('the quote footer should be gone')
if (chrome.inheritBadge) throw new Error('the inherit badge should be gone')
if (prevented !== true) throw new Error('right-click did not suppress the native menu')
if (!rightQuote.includes('右键这段')) throw new Error('right-click opened the wrong quote: ' + rightQuote)
if (!selectionAnswer.includes('LayerFS 的 Branch 创建')) throw new Error('selection text missing from the prompt: ' + selectionAnswer.slice(0, 120))
if (closed !== true) throw new Error('Escape did not close the window')
if (closedByOutside !== true) throw new Error('outside click did not close the window')
console.log('E2E OK')