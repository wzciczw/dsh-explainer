import assert from 'node:assert/strict'
import test from 'node:test'
import { loadBundleModule } from './bundle-modules.mjs'

// Load from the shipped bundle so relative imports (the selection shape)
// resolve exactly as they do in the browser.
const { ExplainerStore } = loadBundleModule('store')

globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle)

const rect = { left: 10, top: 10, right: 100, bottom: 40, width: 90, height: 30 }

/** A stream the test controls frame by frame. */
function controlledStream() {
  let controller
  const body = new ReadableStream({ start(value) { controller = value } })
  return {
    body,
    push(text) { controller.enqueue(new TextEncoder().encode(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`)) },
    done() { controller.enqueue(new TextEncoder().encode('event: done\ndata: {"ms":1}\n\n')); controller.close() },
    close() { try { controller.close() } catch {} },
  }
}

function installFetch(stream) {
  globalThis.fetch = async (url) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: { enabled: true, inheritContext: false, showMeta: true, selectionMaxChars: 6000, contextMaxChars: 0, contextMaxMessages: 0, maxTurns: 3, maxTokens: 300, temperature: 0.3, presets: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(stream.body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
}

const settle = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms))

test('stopping and starting a new conversation ignores late deltas from the old stream', async () => {
  const stream = controlledStream()
  installFetch(stream)
  const store = new ExplainerStore()
  store.openQuick(rect)
  store.setDraft('旧问题')
  const sending = store.send()

  stream.push('部分')
  await settle()
  assert.equal(store.getSnapshot().card.messages.at(-1).text, '部分')

  store.stop()
  assert.equal(store.getSnapshot().card.phase, 'answer')
  assert.equal(store.getSnapshot().card.messages.at(-1).text, '部分')

  store.newThread()
  assert.equal(store.getSnapshot().card.messages.length, 0)
  assert.equal(store.getSnapshot().card.phase, 'input')

  // The old request settles after the thread was replaced: nothing may land.
  stream.push('迟到的内容')
  stream.done()
  await sending
  await settle()
  assert.equal(store.getSnapshot().card.messages.length, 0)
  assert.equal(store.getSnapshot().card.threadId.length > 0, true)
})

test('a composer quick ask inherits the main conversation snapshot', async () => {
  const stream = controlledStream()
  let body
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/explainer/config')) {
      return new Response(JSON.stringify({ ok: true, config: {
        enabled: true, inheritContext: true, showMeta: true, selectionMaxChars: 6000,
        contextMaxChars: 8000, contextMaxMessages: 8, maxTurns: 3, maxTokens: 300,
        temperature: 0.3, presets: [], rightClick: true, autoAnswer: true,
      } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    body = JSON.parse(init.body)
    return new Response(stream.body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  const store = new ExplainerStore()
  store.openQuick(rect)
  store.setDraft('刚才那个方案再展开')
  const sending = store.send()
  stream.push('答')
  stream.done()
  await sending
  assert.equal(body.inheritContext, true, 'quick-ask is a sub-session, not a stateless prompt')
  assert.equal(body.question, '刚才那个方案再展开')
})

test('opening a new selection clears the previous answer and pending text', async () => {
  const stream = controlledStream()
  installFetch(stream)
  const store = new ExplainerStore()
  store.openSelection(rect, '第一段')
  store.setDraft('问一')
  const sending = store.send()
  stream.push('旧答案')
  await settle()
  assert.equal(store.getSnapshot().card.messages.at(-1).text, '旧答案')

  store.openSelection(rect, '第二段')
  const card = store.getSnapshot().card
  assert.equal(card.quote, '第二段')
  assert.equal(card.messages.length, 0, 'the new selection starts an empty thread')
  assert.equal(card.phase, 'input')
  stream.push('迟到')
  await settle()
  assert.equal(store.getSnapshot().card.messages.length, 0, 'late deltas stay out of the new card')
  stream.done()
  await sending.catch(() => {})
})

test('a new pill appears while a card is open and replaces it', async () => {
  installFetch(controlledStream())
  const store = new ExplainerStore()
  store.openSelection(rect, '第一段')
  store.showHint('第二段', rect)
  assert.equal(store.getSnapshot().hint?.text, '第二段')
  store.openSelection(rect, '第二段')
  const card = store.getSnapshot().card
  assert.equal(card.quote, '第二段')
  assert.equal(card.messages.length, 0)
  assert.equal(store.getSnapshot().hint, null)
})
