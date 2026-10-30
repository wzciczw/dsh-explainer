import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeConfig, publicConfig } from '../lib/host/config.js'
import { composeOpening, composeFollowUp } from '../lib/host/prompt.js'
import { readTranscript, readSessionModel } from '../lib/host/transcript.js'
import { ThreadStore } from '../lib/host/threads.js'
import { AskEngine } from '../lib/host/engine.js'
import { listModelCatalog, resolveDefaultRoute } from '../lib/host/models.js'

const EVENTS = [
  { type: 'request/header', data: { header: { config: { provider: 'session-provider', model: 'session-model' } } } },
  { type: 'user/message', data: { content: [{ type: 'text', text: 'LayerFS 的 Branch 贵吗？' }] } },
  { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '创建便宜，合并才贵。' }] }, interrupted: false } },
]

function fakeCtx(events = EVENTS) {
  const reads = { count: 0 }
  const sessions = { get: () => { reads.count += 1; return { header: { cwd: '/' }, snapshotEvents: () => events } } }
  return {
    reads,
    ctx: { get: (key) => (key === 'sessions' ? sessions : undefined), logger: {} },
  }
}

function fakeLlm(deltas = ['你好', '，世界']) {
  const calls = []
  return {
    calls,
    llm: {
      prepareCall: async (config, signal, configure) => {
        const model = { reasoning: { efforts: [{ id: 'high' }, { id: 'off' }] } }
        const controls = { temperature: config.temperature, maxTokens: config.maxTokens }
        const resolved = configure === undefined ? controls : configure(controls, model)
        return {
          config: { ...config, ...resolved },
          // eslint-disable-next-line require-yield
          stream: async function* (options) {
            calls.push(options)
            for (const text of deltas) yield { type: 'text-delta', index: 0, text }
            yield { type: 'finish', reason: { kind: 'stop' } }
          },
        }
      },
      listProviders: () => [{ id: 'fallback-provider' }],
      listModels: async () => [{ id: 'fallback-model' }],
    },
  }
}

test('normalizeConfig clamps every dangerous value', () => {
  const config = normalizeConfig({
    maxTokens: 999999,
    temperature: 9,
    timeoutMs: 1,
    selectionMaxChars: 1,
    contextMaxChars: -5,
    maxTurns: 0,
    maxThreads: 0,
    inheritContext: 'yes',
    presets: ['explain', 'explain', 'x', 4],
  })
  assert.equal(config.maxTokens, 8192)
  assert.equal(config.temperature, 2)
  assert.equal(config.timeoutMs, 3000)
  assert.equal(config.selectionMaxChars, 200)
  assert.equal(config.contextMaxChars, 0)
  assert.equal(config.maxTurns, 1)
  assert.equal(config.maxThreads, 4)
  assert.equal(config.inheritContext, true)
  assert.deepEqual(config.presets, ['explain', 'x'])
  const pub = publicConfig(config)
  assert.equal('systemPrompt' in pub, false)
})

test('composeOpening carries the snapshot, the selection and the question', () => {
  const text = composeOpening({
    selection: '创建便宜，合并才贵。',
    question: '为什么？',
    context: '用户：LayerFS 贵吗？\n\n助手：创建便宜，合并才贵。',
  })
  assert.match(text, /只读快照/)
  assert.match(text, /用户：LayerFS 贵吗？/)
  assert.match(text, /用户选中的文字/)
  assert.match(text, /为什么？/)
  const quick = composeOpening({ selection: '', question: '你好', context: '' })
  assert.doesNotMatch(quick, /只读快照/)
  assert.match(quick, /问题/)
  assert.match(composeFollowUp('再展开点'), /追问/)
})

test('readTranscript keeps the newest turns inside the budget', () => {
  const { ctx } = fakeCtx()
  const sessions = ctx.get('sessions')
  const snapshot = readTranscript(sessions, 's1', 8, 10_000)
  assert.equal(snapshot.turns, 2)
  assert.match(snapshot.text, /创建便宜/)
  assert.deepEqual(snapshot.model, { provider: 'session-provider', model: 'session-model' })
  const tiny = readTranscript(sessions, 's1', 8, 20)
  assert.ok(tiny.chars <= 20 + 8)
  assert.deepEqual(readSessionModel(sessions, 's1'), { provider: 'session-provider', model: 'session-model' })
  assert.equal(readTranscript(undefined, 's1', 8, 100).turns, 0)
})

test('ThreadStore evicts by LRU and by TTL', () => {
  const store = new ThreadStore(2, 1000)
  const seed = { messages: [], inheritContext: true, selection: '', contextText: '', contextChars: 0, turns: 0 }
  store.create({ id: 'a', createdAt: 0, lastUsed: 0, ...seed })
  store.create({ id: 'b', createdAt: 0, lastUsed: 10, ...seed })
  store.create({ id: 'c', createdAt: 0, lastUsed: 20, ...seed })
  assert.equal(store.size(), 2)
  assert.equal(store.get('a', 30), undefined)
  assert.equal(store.get('c', 30)?.id, 'c')
  assert.equal(store.get('b', 5000), undefined)
})

test('one quick-ask thread inherits context once and never writes the session', async () => {
  const { ctx, reads } = fakeCtx()
  const { llm, calls } = fakeLlm()
  const config = normalizeConfig({ inheritContext: true })
  const threads = new ThreadStore(10, 600_000)
  const engine = new AskEngine(ctx, llm, threads, config)

  const deltas = []
  const outcome = await engine.run(
    { threadId: 't1', mode: 'selection', question: '', selection: '创建便宜，合并才贵。', sessionId: 's1', inheritContext: true },
    new AbortController().signal,
    text => deltas.push(text),
  )
  assert.deepEqual(deltas, ['你好', '，世界'])
  assert.equal(outcome.effort, 'off')
  assert.equal(outcome.chars, 5)
  // One read for the transcript, one for the workspace root used by file
  // grounding, one for the session's recorded route on the opening turn.
  assert.equal(reads.count, 3)
  const first = calls[0]
  assert.match(first.messages[0].content[0].text, /只读快照/)
  assert.match(first.system, /快问/)
  assert.equal(first.temperature, 0.3)
  assert.equal(EVENTS.length, 3, 'the main session event log is untouched')

  // A follow-up keeps the thread and does not rebuild the transcript; it only
  // re-reads the session's last request route so a model switch is followed.
  await engine.run(
    { threadId: 't1', mode: 'selection', question: '那 merge 呢', sessionId: 's1' },
    new AbortController().signal,
    () => {},
  )
  // The follow-up re-reads only the session route; the transcript is not rebuilt.
  assert.equal(reads.count, 4)
  const second = calls[1]
  assert.equal(second.messages.length, 3)
  assert.equal(second.messages[1].role, 'assistant')
  assert.equal(second.messages[2].role, 'user')
  assert.match(second.messages[2].content[0].text, /那 merge 呢/)
  assert.equal(EVENTS.length, 3)
})

test('the request route wins, then the main session route, then the plugin config', async () => {
  const { ctx } = fakeCtx()
  const { llm, calls } = fakeLlm()
  const config = normalizeConfig({ provider: 'config-provider', model: 'config-model' })
  const engine = new AskEngine(ctx, llm, new ThreadStore(10, 60_000), config)

  // 1. An explicit request route (what the browser sends) wins.
  await engine.run(
    { threadId: 'route-1', mode: 'quick', question: 'hi', sessionId: 's1', provider: 'request-provider', model: 'request-model' },
    new AbortController().signal,
    () => {},
  )
  assert.equal(calls[0].provider, 'request-provider')
  assert.equal(calls[0].model, 'request-model')

  // 2. Without one, the main session's last request route wins.
  await engine.run(
    { threadId: 'route-2', mode: 'quick', question: 'hi', sessionId: 's1' },
    new AbortController().signal,
    () => {},
  )
  assert.equal(calls[1].provider, 'session-provider')
  assert.equal(calls[1].model, 'session-model')

  // 3. A sessionless ask falls back to the configured route.
  await engine.run(
    { threadId: 'route-3', mode: 'quick', question: 'hi' },
    new AbortController().signal,
    () => {},
  )
  assert.equal(calls[2].provider, 'config-provider')
  assert.equal(calls[2].model, 'config-model')
})

test('defaultModel pins the window without overriding the main session or an explicit ask', async () => {
  const { ctx } = fakeCtx()
  const { llm, calls } = fakeLlm()
  const config = normalizeConfig({ defaultModel: 'newapi/gemini-3.8-flash' })
  assert.deepEqual(config.defaultModel, { provider: 'newapi', model: 'gemini-3.8-flash' })
  const engine = new AskEngine(ctx, llm, new ThreadStore(10, 60_000), config)

  // 1. The main session's own route still wins: the pin is a default, not a lock.
  await engine.run(
    { threadId: 'pin-1', mode: 'quick', question: 'hi', sessionId: 's1' },
    new AbortController().signal,
    () => {},
  )
  assert.equal(calls[0].provider, 'session-provider')

  // 2. Without a session route the pin applies.
  await engine.run(
    { threadId: 'pin-2', mode: 'quick', question: 'hi' },
    new AbortController().signal,
    () => {},
  )
  assert.equal(calls[1].provider, 'newapi')
  assert.equal(calls[1].model, 'gemini-3.8-flash')

  // 3. An explicit request route still wins over the pin.
  await engine.run(
    { threadId: 'pin-3', mode: 'quick', question: 'hi', provider: 'main-user-pick', model: 'kimi-k3' },
    new AbortController().signal,
    () => {},
  )
  assert.equal(calls[2].provider, 'main-user-pick')
  assert.equal(calls[2].model, 'kimi-k3')
  assert.deepEqual(publicConfig(config).defaultModel, { provider: 'newapi', model: 'gemini-3.8-flash' })
})

test('defaultModel accepts the object form and needs a provider for a bare model', () => {
  assert.deepEqual(normalizeConfig({ defaultModel: { provider: 'p', model: 'm' } }).defaultModel, { provider: 'p', model: 'm' })
  assert.equal(normalizeConfig({ defaultModel: 'gemini-3.8-flash' }).defaultModel, undefined)
  assert.deepEqual(
    normalizeConfig({ provider: 'newapi', defaultModel: 'gemini-3.8-flash' }).defaultModel,
    { provider: 'newapi', model: 'gemini-3.8-flash' },
  )
  // Model ids may contain slashes; only the first slash splits.
  assert.deepEqual(
    normalizeConfig({ defaultModel: 'newapi/stepfun/step-5-preview' }).defaultModel,
    { provider: 'newapi', model: 'stepfun/step-5-preview' },
  )
  assert.equal(normalizeConfig({ defaultModel: 42 }).defaultModel, undefined)
})


test('listModelCatalog groups the models the main chat offers, bounded per provider', async () => {
  const ctx = {
    get: key => (key === 'agentDefaultModel'
      ? { currentSelection: () => ({ provider: 'newapi', model: 'deepseek-flash' }) }
      : undefined),
  }
  const llm = {
    prepareCall: async () => { throw new Error('unused') },
    listProviders: () => [
      { id: 'newapi', name: '公司' },
      { id: 'newapi-gemini' },
      { id: 'broken' },
    ],
    listModels: async (provider) => {
      if (provider === 'broken') throw new Error('boom')
      if (provider === 'newapi-gemini') return [{ id: 'gemini-3.8-flash' }, { id: '' }, null]
      return [{ id: 'deepseek-flash', name: 'deepseek-flash' }, { id: 'kimi-k3' }]
    },
  }
  const catalog = await listModelCatalog(ctx, llm)
  assert.deepEqual(catalog.defaultRoute, { provider: 'newapi', model: 'deepseek-flash' })
  assert.deepEqual(catalog.groups, [
    { id: 'newapi', name: '公司', models: [{ id: 'deepseek-flash', name: 'deepseek-flash' }, { id: 'kimi-k3', name: 'kimi-k3' }] },
    { id: 'newapi-gemini', name: 'newapi-gemini', models: [{ id: 'gemini-3.8-flash', name: 'gemini-3.8-flash' }] },
  ], 'a throwing provider is dropped instead of failing the whole catalog')

  // The deployment default beats "first advertised" when the pin is absent.
  const route = await resolveDefaultRoute({ ctx, llm, config: normalizeConfig({}) })
  assert.deepEqual(route, { provider: 'newapi', model: 'deepseek-flash' })
  // A pin still wins over everything else.
  const pinned = await resolveDefaultRoute({ ctx, llm, config: normalizeConfig({ defaultModel: 'newapi-gemini/gemini-3.8-flash' }) })
  assert.deepEqual(pinned, { provider: 'newapi-gemini', model: 'gemini-3.8-flash' })
})

test('file grounding reads the workspace read-only and refuses paths outside it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'explainer-test-'))
  await writeFile(join(directory, 'notes.md'), '# hello\nlast updated facts', 'utf8')

  const sessions = {
    get: () => ({ header: { cwd: directory }, snapshotEvents: () => [] }),
  }
  const ctx = { get: key => (key === 'sessions' ? sessions : undefined), logger: {} }
  const { llm, calls } = fakeLlm()
  const engine = new AskEngine(ctx, llm, new ThreadStore(10, 60_000), normalizeConfig({ inheritContext: false }))

  await engine.run(
    { threadId: 'file-1', mode: 'quick', question: 'notes.md 什么时候更新？', sessionId: 's1' },
    new AbortController().signal,
    () => {},
  )
  const first = calls[0].messages[0].content[0].text
  assert.match(first, /\[文件快照\]/)
  assert.match(first, /notes\.md/)
  assert.match(first, /修改时间: /)
  assert.match(first, /last updated facts/)

  await engine.run(
    { threadId: 'file-2', mode: 'quick', question: 'C:\\Windows\\win.ini 的内容是什么？', sessionId: 's1' },
    new AbortController().signal,
    () => {},
  )
  const second = calls[1].messages[0].content[0].text
  // The path is outside the workspace, so no snapshot is injected at all.
  assert.doesNotMatch(second, /\[文件快照\]/)
})

test('a right-sidebar file is read whole as the primary context', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'explainer-file-'))
  const filePath = join(directory, 'notes.md')
  await writeFile(filePath, '# Notes\nThe answer is 42.', 'utf8')

  const sessions = {
    get: () => ({ header: { cwd: directory }, snapshotEvents: () => [] }),
  }
  const ctx = { get: key => (key === 'sessions' ? sessions : undefined), logger: {} }
  const { llm, calls } = fakeLlm()
  const engine = new AskEngine(ctx, llm, new ThreadStore(10, 60_000), normalizeConfig({ inheritContext: false }))

  await engine.run(
    { threadId: 'file-context-1', mode: 'selection', question: '这是什么？', selection: 'The answer', filePath, sessionId: 's1' },
    new AbortController().signal,
    () => {},
  )
  const message = calls[0].messages[0].content[0].text
  assert.match(message, /\[当前文件\]/)
  assert.match(message, /notes\.md/)
  assert.match(message, /The answer is 42/)
  assert.match(message, /修改时间: /)
  assert.doesNotMatch(message, /\[文件快照\]/, 'the explicit file replaces path-based grounding')

  const outsideDir = await mkdtemp(join(tmpdir(), 'explainer-out-'))
  const outsidePath = join(outsideDir, 'secret.txt')
  await writeFile(outsidePath, 'top secret', 'utf8')
  await engine.run(
    { threadId: 'file-context-2', mode: 'selection', question: 'hi', filePath: outsidePath, sessionId: 's1' },
    new AbortController().signal,
    () => {},
  )
  const second = calls[1].messages[0].content[0].text
  assert.doesNotMatch(second, /\[当前文件\]/, 'outside the workspace is refused')
  assert.doesNotMatch(second, /top secret/)
})

test('a busy engine refuses instead of queueing', async () => {
  const { ctx } = fakeCtx()
  const { llm } = fakeLlm()
  const config = normalizeConfig({ maxConcurrent: 1 })
  const engine = new AskEngine(ctx, llm, new ThreadStore(10, 60_000), config)
  const blocker = engine.run(
    { threadId: 'a', mode: 'quick', question: 'one', sessionId: undefined },
    new AbortController().signal,
    () => {},
  )
  await assert.rejects(
    engine.run({ threadId: 'b', mode: 'quick', question: 'two' }, new AbortController().signal, () => {}),
    /too many/,
  )
  await blocker
})

test('a time-sensitive question searches the web and injects cited sources', async () => {
  const web = {
    requests: [],
    search: async (request) => {
      web.requests.push(request)
      return {
        content: 'Claude 的最新上下文窗口是 1M。',
        sources: [{ url: 'https://example.com/models', title: 'Model docs', snippet: 'Context window 1M.' }],
      }
    },
  }
  const sessions = { get: () => ({ header: { cwd: '/' }, snapshotEvents: () => [] }) }
  const ctx = { get: key => (key === 'sessions' ? sessions : key === 'web' ? web : undefined), logger: {} }
  const { llm, calls } = fakeLlm()
  const engine = new AskEngine(ctx, llm, new ThreadStore(10, 60_000), normalizeConfig({ inheritContext: false, webSearch: true }))
  const meta = []
  await engine.run(
    { threadId: 'web-1', mode: 'quick', question: 'opus和sonnet最新的上下文窗口是多少' },
    new AbortController().signal,
    () => {},
    value => meta.push(value),
  )
  assert.equal(web.requests.length, 1)
  assert.match(web.requests[0].query, /opus/)
  const prompt = calls[0].messages[0].content[0].text
  assert.match(prompt, /\[联网检索\]/)
  assert.match(prompt, /https:\/\/example\.com\/models/)
  assert.equal(meta[0].web, 1)
})

test('an ordinary explanation does not search the web', async () => {
  const web = { requests: [], search: async (request) => { web.requests.push(request); return { sources: [] } } }
  const sessions = { get: () => ({ header: { cwd: '/' }, snapshotEvents: () => [] }) }
  const ctx = { get: key => (key === 'sessions' ? sessions : key === 'web' ? web : undefined), logger: {} }
  const { llm } = fakeLlm()
  const engine = new AskEngine(ctx, llm, new ThreadStore(10, 60_000), normalizeConfig({ inheritContext: false, webSearch: true }))
  await engine.run({ threadId: 'web-2', mode: 'quick', question: '解释一下分支为什么便宜' }, new AbortController().signal, () => {})
  assert.equal(web.requests.length, 0)
})
