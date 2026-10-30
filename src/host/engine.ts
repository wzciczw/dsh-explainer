import type {
  AskRequest,
  DefaultModelLike,
  ExplainerConfig,
  HostPluginContext,
  LlmServiceLike,
  SessionsServiceLike,
  StreamChunkLike,
  ThreadMessage,
  WebServiceLike,
} from './types.js'
import { composeFollowUp, composeOpening, SYSTEM_PROMPT } from './prompt.js'
import { readSessionCwd, readSessionModel, readTranscript } from './transcript.js'
import { firstAdvertised } from './models.js'
import { readFileContext, readFileGrounding } from './files.js'
import type { Thread, ThreadStore } from './threads.js'

/** Time-sensitive vocabulary worth one retrieval call. */
const FRESH = /(最新|当前|现在|今天|今年|近日|价格|发布|版本|更新|截止|截至|上下文窗口|模型|opus|sonnet|gpt|gemini|claude|latest|current|today|price|release|version|changelog|context window)/i

function shouldSearch(text: string): boolean {
  return FRESH.test(text)
}

/** Prefer the typed question; a generic "latest info" preset uses the selection. */
function searchQuery(question: string, selection: string): string {
  const q = question.replace(/\s+/g, ' ').trim()
  if (q.length >= 4 && !/^(查一下|查最新|最新信息|最新情况)[：: ]*$/.test(q)) return q.slice(0, 200)
  return (selection.replace(/\s+/g, ' ').trim() || q).slice(0, 240)
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function formatWeb(result: { content?: string; sources?: ReadonlyArray<{ url: string; title?: string; snippet?: string }> }, query: string): string {
  const lines = ['查询：' + query]
  const summary = result.content?.trim()
  if (summary !== undefined && summary !== '') lines.push('摘要：' + clip(summary, 900))
  for (const source of (result.sources ?? []).slice(0, 4)) {
    const title = source.title?.trim() || source.url
    const snippet = source.snippet?.trim()
    lines.push('- ' + title + ' ' + source.url + (snippet === undefined || snippet === '' ? '' : ' — ' + clip(snippet, 300)))
  }
  return lines.length > 1 ? lines.join('\n') : ''
}


/** A refusal the SSE writer can serialize without leaking internals. */
export class AskError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'AskError'
  }
}

/** Why one ask finished, for the SSE `done` frame. */
export interface AskOutcome {
  provider: string
  model: string
  effort?: string
  ms: number
  usage?: { inputTokens?: number; outputTokens?: number }
  chars: number
}

/** One host-side ask engine shared by every thread. */
export class AskEngine {
  private active = 0

  constructor(
    private readonly ctx: HostPluginContext,
    private readonly llm: LlmServiceLike,
    private readonly threads: ThreadStore,
    private readonly config: ExplainerConfig,
  ) {}

  /** Number of in-flight completions (diagnostics). */
  inFlight(): number {
    return this.active
  }

  /**
   * Run one turn and stream visible text through `onDelta`.
   *
   * The thread is created on first use from a read-only snapshot of the main
   * session, then only ever appended to in host memory. Nothing here writes to
   * the Session log.
   */
  async run(
    request: AskRequest,
    signal: AbortSignal,
    onDelta: (text: string) => void,
    onMeta?: (meta: { provider: string; model: string; effort?: string; contextChars: number; web?: number }) => void,
  ): Promise<AskOutcome> {
    if (!this.config.enabled) throw new AskError('disabled', 'the explainer plugin is disabled', 503)
    if (this.active >= this.config.maxConcurrent) {
      throw new AskError('busy', 'too many quick-ask requests are running; try again shortly', 429)
    }
    if (typeof request.threadId !== 'string' || request.threadId.length === 0 || request.threadId.length > 128) {
      throw new AskError('bad-request', 'threadId is required')
    }
    if (request.mode !== 'selection' && request.mode !== 'quick') {
      throw new AskError('bad-request', 'mode must be selection or quick')
    }

    // Reserve the slot before the first await: a burst of opens must not all
    // pass the limit while their routes are still resolving.
    this.active += 1
    try {
      const sessions = this.ctx.get?.('sessions') as SessionsServiceLike | undefined
      let webSources = 0
      const now = Date.now()
      let thread = this.threads.get(request.threadId, now)
      const created = thread === undefined
      if (thread === undefined) {
        const inherit = request.inheritContext ?? this.config.inheritContext
        const snapshot = inherit
          ? readTranscript(sessions, request.sessionId, this.config.contextMaxMessages, this.config.contextMaxChars)
          : { text: '', turns: 0, chars: 0 }
        const cwd = readSessionCwd(sessions, request.sessionId)
        const explicitFile = this.config.fileAccess && request.filePath !== undefined
          ? await readFileContext(cwd, request.filePath, this.config.fileContextMaxChars)
          : ''
        const files = !this.config.fileAccess || explicitFile !== ''
          ? ''
          : await readFileGrounding({
              cwd,
              text: [request.selection ?? '', request.question, snapshot.text].join('\n'),
              maxFiles: this.config.fileMaxFiles,
              maxChars: this.config.fileMaxChars,
              excerptChars: this.config.fileExcerptChars,
            })
        const web = await this.searchWeb(request, signal)
        webSources = web.count
        const first = composeOpening({
          selection: request.selection ?? '',
          question: request.question,
          context: snapshot.text,
          files,
          file: explicitFile,
          web: web.text,
        })
        thread = this.threads.create({
          id: request.threadId,
          createdAt: now,
          lastUsed: now,
          messages: [{ role: 'user', content: [{ type: 'text', text: first }] }],
          ...(snapshot.model === undefined ? {} : { model: snapshot.model }),
          inheritContext: inherit,
          selection: request.selection ?? '',
          contextText: snapshot.text,
          ...(cwd === undefined ? {} : { cwd }),
          contextChars: snapshot.chars,
          turns: 0,
        })
      } else {
        const files = this.config.fileAccess
          ? await readFileGrounding({
              cwd: thread.cwd,
              text: [thread.selection, request.question, thread.contextText].join('\n'),
              maxFiles: this.config.fileMaxFiles,
              maxChars: this.config.fileMaxChars,
              excerptChars: this.config.fileExcerptChars,
            })
          : ''
        thread.messages.push({ role: 'user', content: [{ type: 'text', text: composeFollowUp(request.question, files) }] })
      }

      const target = await this.resolveTarget(request, thread, sessions, created)
      const messages = this.trim(thread.messages)
      const started = Date.now()

      const call = await this.llm.prepareCall(
        {
          provider: target.provider,
          model: target.model,
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        },
        signal,
        (controls, model) => {
          const effort = this.selectEffort(model, this.config.reasoningEffort)
          // Gemini/Claude thinking cannot always be disabled. Their reasoning
          // tokens share the output budget, so an 800-token answer cap can be
          // spent before any visible text is emitted. Give mandatory-thinking
          // models room for thinking plus the short answer.
          const efforts = model.reasoning?.efforts ?? []
          const mandatoryThinking = efforts.length > 0 && !efforts.some(item => item.id === 'off')
          const floor = effort === 'high' || effort === 'xhigh' || effort === 'max' ? 8_192 : 4_096
          const maxTokens = mandatoryThinking
            ? Math.min(8_192, Math.max(controls.maxTokens ?? 800, floor))
            : controls.maxTokens
          return {
            ...controls,
            ...(maxTokens === undefined ? {} : { maxTokens }),
            ...(effort === undefined ? {} : { reasoningEffort: effort }),
          }
        },
      )

      onMeta?.({
        provider: target.provider,
        model: target.model,
        ...(call.config.reasoningEffort === undefined ? {} : { effort: call.config.reasoningEffort }),
        contextChars: thread.contextChars,
        ...(webSources > 0 ? { web: webSources } : {}),
      })

      // A copy: the adapter reads this array for the whole stream, while the
      // thread keeps growing after the answer settles.
      const options: Record<string, unknown> = {
        ...call.config,
        messages: [...messages],
        system: SYSTEM_PROMPT,
        signal,
      }

      let answer = ''
      let finish: { kind: string; failure?: { message?: string; code?: string } } | undefined
      let usage: { inputTokens?: number; outputTokens?: number } | undefined
      let done = false
      const iterator = call.stream(options)[Symbol.asyncIterator]()
      let deadlineTimer: ReturnType<typeof setTimeout> | undefined
      // The adapter normally honors the request signal, but a provider that
      // ignores abort must not pin a concurrency slot forever. Race the
      // iterator against a hard deadline and close it on the way out.
      const deadline = new Promise<never>((_, reject) => {
        deadlineTimer = setTimeout(() => reject(new AskError('timeout', 'the answer timed out', 504)), this.config.timeoutMs)
        deadlineTimer.unref?.()
      })
      try {
        while (true) {
          const next = await Promise.race([iterator.next(), deadline])
          if (next.done === true) { done = true; break }
          const chunk = next.value
          const kind = (chunk as StreamChunkLike).type
          if (kind === 'text-delta') {
            const text = (chunk as { text?: string }).text ?? ''
            if (text !== '') {
              answer += text
              onDelta(text)
            }
          } else if (kind === 'finish') {
            finish = (chunk as { reason?: { kind: string; failure?: { message?: string; code?: string } } }).reason
          } else if (kind === 'usage') {
            usage = (chunk as { usage?: { inputTokens?: number; outputTokens?: number } }).usage
          }
        }
      } finally {
        if (deadlineTimer !== undefined) clearTimeout(deadlineTimer)
        if (!done) {
          // Do not await: an adapter that ignores abort can also stall return().
          try { void iterator.return?.() } catch { /* provider already closed */ }
        }
      }

      signal.throwIfAborted()
      if (finish !== undefined && finish.kind !== 'stop' && finish.kind !== 'max-tokens') {
        throw new AskError(
          finish.kind === 'aborted' ? 'aborted' : 'model-error',
          finish.failure?.message ?? `the model stopped: ${finish.kind}`,
          502,
        )
      }
      if (answer.trim() === '') {
        throw new AskError('empty-answer', 'the model returned no text', 502)
      }

      thread.messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: answer }],
        id: cryptoRandomId(),
        source: { kind: 'model', provider: target.provider, model: target.model },
      })
      thread.model = { provider: target.provider, model: target.model }
      thread.turns += 1
      thread.lastUsed = Date.now()
      thread.messages = this.trim(thread.messages)

      return {
        provider: target.provider,
        model: target.model,
        ...(call.config.reasoningEffort === undefined ? {} : { effort: call.config.reasoningEffort }),
        ms: Date.now() - started,
        ...(usage === undefined ? {} : { usage }),
        chars: answer.length,
      }
    } finally {
      this.active -= 1
    }
  }
  /** One bounded web search for a time-sensitive opening turn; failures never block the answer. */
  private async searchWeb(
    request: AskRequest,
    signal: AbortSignal,
  ): Promise<{ text: string; count: number }> {
    if (!this.config.webSearch) return { text: '', count: 0 }
    const sourceText = [request.question, request.selection ?? ''].join('\n')
    if (!shouldSearch(sourceText)) return { text: '', count: 0 }
    const web = this.ctx.get?.('web') as WebServiceLike | undefined
    if (web === undefined || typeof web.search !== 'function') return { text: '', count: 0 }
    const query = searchQuery(request.question, request.selection ?? '')
    if (query === '') return { text: '', count: 0 }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6_000)
    timer.unref?.()
    const combined = typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, controller.signal]) : signal
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error('web search timeout')), 6_000)
      timeoutTimer.unref?.()
    })
    try {
      // Race the provider too: a provider that ignores abort must not pin the
      // request before the model call even starts.
      const result = await Promise.race([
        web.search({ query, maxResults: this.config.webSearchMaxResults }, combined),
        timeout,
      ])
      const text = formatWeb(result, query)
      return { text, count: text === '' ? 0 : (result.sources?.length ?? 0) }
    } catch {
      return { text: '', count: 0 }
    } finally {
      clearTimeout(timer)
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer)
    }
  }

  /** Keep the opening turn plus the newest follow-up turns. */
  private trim(messages: ThreadMessage[]): ThreadMessage[] {
    const keep = Math.max(2, this.config.maxTurns * 2)
    if (messages.length <= keep + 1) return messages
    const first = messages[0]
    const tail = messages.slice(-keep)
    return first === undefined ? tail : [first, ...tail]
  }

  /**
   * Resolve the exact route for this turn.
   *
   * Precedence: explicit request → the main session's last request header →
   * a continuing thread's own route → the plugin row's `defaultModel` →
   * legacy `provider`+`model` → the deployment default → the first advertised
   * provider/model. The last two exist so a fresh profile with one configured
   * provider still works without extra setup.
   */
  private async resolveTarget(
    request: AskRequest,
    thread: Thread,
    sessions: SessionsServiceLike | undefined,
    created: boolean,
  ): Promise<{ provider: string; model: string }> {
    // The product rule: the quick-ask window uses the main window's model.
    // The browser sends that model explicitly; these fallbacks keep a
    // sessionless or older client on the same route instead of a pinned one.
    if (typeof request.provider === 'string' && request.provider !== '' && typeof request.model === 'string' && request.model !== '') {
      return { provider: request.provider, model: request.model }
    }
    const sessionModel = request.sessionId === undefined
      ? undefined
      : readSessionModel(sessions, request.sessionId)
    if (sessionModel !== undefined) return sessionModel
    // A brand-new thread already captured the route from the same read-only
    // snapshot, so do not scan the log again on the opening turn.
    if (created) {
      if (thread.model !== undefined) return thread.model
    } else if (thread.model !== undefined) {
      return thread.model
    }
    // The plugin row may pin the window to one of the models the main chat also
    // offers. The session's own recorded route above still wins, because that
    // route is what the user is looking at in the main window.
    if (this.config.defaultModel !== undefined) return this.config.defaultModel
    if (this.config.provider !== undefined && this.config.model !== undefined) {
      return { provider: this.config.provider, model: this.config.model }
    }

    try {
      const selection = (this.ctx.get?.('agentDefaultModel') as DefaultModelLike | undefined)?.currentSelection?.()
      if (typeof selection?.provider === 'string' && typeof selection.model === 'string') {
        return { provider: selection.provider, model: selection.model }
      }
    } catch {
      // An absent or failing default-model service is not fatal: fall through.
    }

    const advertised = await firstAdvertised(this.llm)
    if (advertised === undefined) throw new AskError('no-model', 'no LLM provider advertises a model', 503)
    return advertised
  }

  /** Lowest supported reasoning effort, unless the config pins one. */
  private selectEffort(
    model: { reasoning?: { efforts?: ReadonlyArray<{ id: string }>; defaultEffort?: string } },
    pinned: string | undefined,
  ): string | undefined {
    const efforts = model.reasoning?.efforts
    if (efforts === undefined || efforts.length === 0) return undefined
    const ids = efforts.map(item => item.id)
    if (pinned !== undefined) {
      if (ids.includes(pinned)) return pinned
      // A pinned value this model no longer supports must not fail the turn;
      // fall back to the lowest supported level instead.
    }
    for (const candidate of ['off', 'minimal', 'low']) {
      if (ids.includes(candidate)) return candidate
    }
    return ids[0]
  }
}

/** A UUID without importing node:crypto into the bundle surface under test. */
function cryptoRandomId(): string {
  const crypto = globalThis.crypto
  if (crypto !== undefined && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}