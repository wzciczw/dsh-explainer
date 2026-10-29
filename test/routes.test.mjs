import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import test from 'node:test'
import { apply } from '../lib/host/index.js'

const SESSION_EVENTS = [
  { type: 'request/header', data: { header: { config: { provider: 'session-provider', model: 'session-model' } } } },
  { type: 'user/message', data: { content: [{ type: 'text', text: 'Branch 贵吗？' }] } },
  { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '创建便宜，合并贵。' }] } } },
]

function fakeRes() {
  const res = new EventEmitter()
  res.status = 0
  res.headers = {}
  res.chunks = []
  res.writableEnded = false
  res.flushHeaders = () => {}
  res.socket = { setNoDelay: () => {} }
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers ?? {} }
  res.write = (chunk) => { res.chunks.push(String(chunk)); return true }
  res.end = (chunk) => {
    if (chunk !== undefined) res.chunks.push(String(chunk))
    res.writableEnded = true
    res.emit('close')
  }
  res.body = () => res.chunks.join('')
  return res
}

function fakeReq(body, method = 'POST') {
  const stream = Readable.from([Buffer.from(JSON.stringify(body))])
  stream.method = method
  stream.url = '/explainer/ask'
  stream.headers = { host: '127.0.0.1' }
  return stream
}

function harness(connectionRejection = undefined) {
  const routes = new Map()
  const llmCalls = []
  const llm = {
    prepareCall: async (config, signal, configure) => {
      const model = { reasoning: { efforts: [{ id: 'high' }, { id: 'off' }] } }
      const controls = { temperature: config.temperature, maxTokens: config.maxTokens }
      const resolved = configure === undefined ? controls : configure(controls, model)
      return {
        config: { ...config, ...resolved },
        stream: async function* (options) {
          llmCalls.push(options)
          yield { type: 'text-delta', index: 0, text: '创建' }
          yield { type: 'text-delta', index: 0, text: '便宜' }
          yield { type: 'finish', reason: { kind: 'stop' } }
        },
      }
    },
    listProviders: () => [{ id: 'p' }],
    listModels: async () => [{ id: 'm' }],
  }
  const ctx = {
    get: (key) => {
      if (key === 'llm') return llm
      if (key === 'webServer') return { register: (route) => { routes.set(route.path, route); return () => routes.delete(route.path) } }
      if (key === 'sessions') return { get: () => ({ snapshotEvents: () => SESSION_EVENTS }) }
      return undefined
    },
    connection: { requestRejection: connectionRejection ?? (() => undefined) },
    effect: (fn) => { fn() },
    logger: { info: () => {}, warn: () => {} },
  }
  apply(ctx, { maxTokens: 300, inheritContext: true })
  return { routes, llmCalls }
}

test('apply registers the config and ask routes', () => {
  const { routes } = harness()
  assert.deepEqual([...routes.keys()].sort(), ['/explainer/ask', '/explainer/config'])
})

test('the config route answers with the public configuration', async () => {
  const { routes } = harness()
  const route = routes.get('/explainer/config')
  const req = fakeReq({}, 'GET')
  const res = fakeRes()
  route.handler(req, res)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(res.status, 200)
  const payload = JSON.parse(res.body())
  assert.equal(payload.ok, true)
  assert.equal(payload.config.maxTokens, 300)
  assert.equal(payload.version, 1)
})

test('the ask route streams meta, deltas and a done frame', async () => {
  const { routes, llmCalls } = harness()
  const route = routes.get('/explainer/ask')
  const res = fakeRes()
  await route.handler(fakeReq({
    threadId: 'thread-1',
    mode: 'selection',
    question: '',
    selection: '创建便宜，合并贵。',
    sessionId: 's1',
    inheritContext: true,
  }), res)
  assert.equal(res.status, 200)
  assert.match(String(res.headers['content-type']), /text\/event-stream/)
  const frames = res.body().split('\n\n').filter(Boolean)
  const events = frames.map(frame => {
    const event = /event: (.*)/.exec(frame)?.[1]
    const data = JSON.parse(/data: (.*)/.exec(frame)?.[1] ?? '{}')
    return { event, data }
  })
  assert.deepEqual(events.map(item => item.event), ['meta', 'delta', 'delta', 'done'])
  assert.equal(events[0].data.model, 'session-model')
  assert.equal(events[0].data.effort, 'off')
  assert.equal(events[1].data.text + events[2].data.text, '创建便宜')
  assert.equal(events[3].data.chars, 4)
  assert.equal(llmCalls.length, 1)
  assert.match(llmCalls[0].messages[0].content[0].text, /只读快照/)
  assert.equal(SESSION_EVENTS.length, 3)
})

test('the routes fail closed without the connection fence', async () => {
  const { routes } = harness(() => ({ code: 'forbidden' }))
  const route = routes.get('/explainer/config')
  const req = fakeReq({}, 'GET')
  const res = fakeRes()
  route.handler(req, res)
  assert.equal(res.status, 403)
  assert.match(res.body(), /forbidden/)
})

test('a malformed body is refused before any stream starts', async () => {
  const { routes } = harness()
  const route = routes.get('/explainer/ask')
  const res = fakeRes()
  await route.handler(fakeReq({ mode: 'nope' }), res)
  assert.equal(res.status, 400)
  assert.match(res.body(), /mode must be selection or quick/)
})