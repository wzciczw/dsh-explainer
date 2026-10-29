import type {
  CardState,
  ComposerBridge,
  Meta,
  PublicConfig,
  RectLike,
  Snapshot,
  Turn,
} from './types'

/** Client fallback when the config route has not answered yet. */
const DEFAULTS: PublicConfig = {
  enabled: true,
  maxTokens: 800,
  temperature: 0.3,
  selectionMaxChars: 6_000,
  contextMaxChars: 8_000,
  contextMaxMessages: 8,
  maxTurns: 3,
  inheritContext: true,
  showMeta: true,
  rightClick: true,
  presets: ['explain', 'translate', 'summary', 'example'],
  provider: null,
  model: null,
}

/** A typed transport refusal worth showing verbatim. */
class StreamError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function newId(): string {
  const crypto = globalThis.crypto
  if (crypto !== undefined && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function turn(role: 'user' | 'assistant', text: string, extra?: Partial<Turn>): Turn {
  return { id: newId(), role, text, ...extra }
}

/** The single browser-side state machine for the pill and the window. */
export class ExplainerStore {
  private listeners = new Set<() => void>()
  private snap: Snapshot = { hint: null, card: null, config: null, bridge: null, sessionId: null, sessionModel: null, notice: null, ready: false }
  private noticeTimer = 0
  private noticeId = 0
  private abort: AbortController | null = null
  private abortReason: 'user' | 'timeout' | null = null
  private raf = 0
  private pending = ''
  private pendingTurnId = ''
  private generation = 0
  private activeGeneration = 0
  private configTask: Promise<void> | null = null

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): Snapshot => this.snap

  private emit(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch }
    for (const listener of this.listeners) listener()
  }

  private patchCard(fn: (card: CardState) => CardState): void {
    const card = this.snap.card
    if (card === null) return
    const next = fn(card)
    if (next !== card) this.emit({ card: next })
  }

  /* ------------------------------------------------------------------ hint */

  /** The host row can be disabled from the profile; the UI then stays inert. */
  private disabled(): boolean {
    return this.snap.ready && this.snap.config?.enabled === false
  }

  showHint(text: string, rect: RectLike): void {
    if (this.disabled() || this.snap.card !== null) return
    const current = this.snap.hint
    if (
      current !== null
      && current.text === text
      && Math.abs(current.rect.left - rect.left) < 2
      && Math.abs(current.rect.top - rect.top) < 2
    ) return
    this.emit({ hint: { text, rect } })
  }

  hideHint(): void {
    if (this.snap.hint !== null) this.emit({ hint: null })
  }

  /* ------------------------------------------------------------------ open */

  private freshCard(mode: 'selection' | 'quick', anchor: RectLike, quote: string, inheritContext: boolean): CardState {
    return {
      mode,
      quote,
      anchor,
      phase: 'input',
      messages: [],
      draft: '',
      meta: null,
      inheritContext,
      quoteExpanded: false,
      threadId: newId(),
      position: null,
      lastQuestion: '',
    }
  }

  openSelection(anchor: RectLike, text: string): void {
    if (this.disabled()) return
    const config = this.snap.config ?? DEFAULTS
    const quote = text.slice(0, config.selectionMaxChars)
    this.emit({
      hint: null,
      card: this.freshCard('selection', anchor, quote, config.inheritContext),
    })
    this.ensureConfig()
  }

  openQuick(anchor: RectLike): void {
    if (this.disabled()) return
    this.emit({
      hint: null,
      card: this.freshCard('quick', anchor, '', false),
    })
    this.ensureConfig()
  }

  close(): void {
    this.stop(true)
    this.emit({ card: null, hint: null })
  }

  /* --------------------------------------------------------------- actions */

  setDraft(draft: string): void {
    this.patchCard(card => (card.draft === draft ? card : { ...card, draft }))
  }

  toggleQuote(): void {
    this.patchCard(card => ({ ...card, quoteExpanded: !card.quoteExpanded }))
  }

  moveTo(x: number, y: number): void {
    this.patchCard(card => ({ ...card, position: { x, y } }))
  }

  newThread(): void {
    if (this.snap.card === null) return
    this.stop(true)
    this.patchCard(card => ({
      ...card,
      phase: 'input',
      messages: [],
      draft: '',
      meta: null,
      threadId: newId(),
      position: card.position,
      lastQuestion: '',
    }))
  }

  retry(): void {
    const card = this.snap.card
    if (card === null || card.phase === 'streaming') return
    const question = card.lastQuestion
    this.stop(true)
    this.patchCard(current => ({
      ...current,
      phase: 'input',
      messages: [],
      draft: question,
      meta: null,
      threadId: newId(),
      lastQuestion: '',
    }))
    this.send()
  }

  async send(): Promise<void> {
    const card = this.snap.card
    if (card === null || card.phase === 'streaming') return
    const config = this.snap.config ?? DEFAULTS
    const draft = card.draft.trim()
    const first = card.messages.length === 0
    if (draft === '' && (!first || card.mode === 'quick')) return
    const question = draft
    const userText = draft === ''
      ? (card.mode === 'selection' ? '解释这段' : '')
      : draft
    if (userText === '') return

    const assistantId = newId()
    this.pendingTurnId = assistantId
    this.pending = ''
    this.patchCard(current => ({
      ...current,
      phase: 'streaming',
      draft: '',
      meta: null,
      lastQuestion: question,
      messages: [
        ...current.messages,
        turn('user', userText),
        turn('assistant', '', { streaming: true, id: assistantId }),
      ],
    }))

    const generation = ++this.generation
    this.activeGeneration = generation
    const controller = new AbortController()
    this.abort = controller
    this.abortReason = null

    const body = {
      threadId: card.threadId,
      mode: card.mode,
      question,
      ...(card.mode === 'selection' && first ? { selection: card.quote } : {}),
      ...(this.snap.sessionModel === null
        ? {}
        : { provider: this.snap.sessionModel.provider, model: this.snap.sessionModel.model }),
      ...(this.snap.bridge?.sessionId === undefined
        ? (this.snap.sessionId === null ? {} : { sessionId: this.snap.sessionId })
        : { sessionId: this.snap.bridge.sessionId }),
      inheritContext: card.inheritContext,
    }

    try {
      const response = await fetch('/explainer/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) {
        let code = `http-${response.status}`
        let message = `request failed (${response.status})`
        try {
          const data = await response.json() as { error?: { code?: unknown; message?: unknown } }
          if (typeof data?.error?.code === 'string') code = data.error.code
          if (typeof data?.error?.message === 'string') message = data.error.message
        } catch {
          // keep the HTTP fallback
        }
        throw new StreamError(code, message)
      }
      if (response.body === null) throw new StreamError('no-body', 'the server returned no stream')
      await this.readStream(response.body, controller.signal)
      if (generation !== this.generation) return
      this.flushPending()
      this.finishStreaming()
    } catch (error) {
      if (generation !== this.generation) return
      this.flushPending()
      const aborted = controller.signal.aborted
      if (aborted && this.abortReason === 'user') {
        this.finishStreaming()
        return
      }
      const message = aborted
        ? '回答超时，请重试'
        : error instanceof Error ? error.message : String(error)
      this.failStreaming(message, error instanceof StreamError ? error.code : 'internal')
    } finally {
      if (this.abort === controller) this.abort = null
    }
  }

  /** Stop the in-flight answer, keeping whatever text already arrived. */
  stop(silent = false): void {
    if (!silent) {
      this.flushPending()
      this.finishStreaming()
    }
    if (this.abort !== null) {
      this.abortReason = 'user'
      this.abort.abort()
      this.abort = null
    }
    // Invalidate the in-flight send: its late deltas must not land in a
    // thread the user already replaced or closed.
    this.generation += 1
  }

  /* -------------------------------------------------------------- transport */

  private async readStream(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        if (signal.aborted) return
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let index = buffer.indexOf('\n\n')
        while (index >= 0) {
          this.handleFrame(buffer.slice(0, index))
          buffer = buffer.slice(index + 2)
          index = buffer.indexOf('\n\n')
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private handleFrame(frame: string): void {
    if (this.activeGeneration !== this.generation) return
    let event = 'message'
    const data: string[] = []
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (data.length === 0) return
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(data.join('\n')) as Record<string, unknown>
    } catch {
      return
    }
    if (event === 'delta') {
      const text = typeof payload.text === 'string' ? payload.text : ''
      if (text !== '') {
        this.pending += text
        this.scheduleFlush()
      }
      return
    }
    if (event === 'meta') {
      this.patchCard(card => ({
        ...card,
        meta: {
          provider: typeof payload.provider === 'string' ? payload.provider : undefined,
          model: typeof payload.model === 'string' ? payload.model : undefined,
          effort: typeof payload.effort === 'string' ? payload.effort : undefined,
          contextChars: typeof payload.contextChars === 'number' ? payload.contextChars : undefined,
        } satisfies Meta,
      }))
      return
    }
    if (event === 'error') {
      const message = typeof payload.message === 'string' ? payload.message : '生成失败'
      throw new StreamError(typeof payload.code === 'string' ? payload.code : 'error', message)
    }
    if (event === 'done') {
      const ms = typeof payload.ms === 'number' ? payload.ms : undefined
      this.patchCard(card => ({
        ...card,
        meta: {
          ...card.meta,
          ...(ms === undefined ? {} : { ms }),
        },
      }))
    }
  }

  private scheduleFlush(): void {
    if (this.raf !== 0) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.flushPending()
    })
  }

  private flushPending(): void {
    if (this.raf !== 0) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
    const text = this.pending
    this.pending = ''
    if (text === '') return
    const id = this.pendingTurnId
    this.patchCard(card => ({
      ...card,
      messages: card.messages.map(item => (item.id === id ? { ...item, text: item.text + text } : item)),
    }))
  }

  private finishStreaming(): void {
    const id = this.pendingTurnId
    this.patchCard(card => ({
      ...card,
      phase: 'answer',
      messages: card.messages.map(item => (item.id === id ? { ...item, streaming: false } : item)),
    }))
  }

  private failStreaming(message: string, code: string): void {
    const id = this.pendingTurnId
    this.patchCard(card => ({
      ...card,
      phase: 'answer',
      messages: card.messages.map(item => (item.id === id
        ? { ...item, streaming: false, error: message, errorCode: code, text: item.text === '' ? '' : item.text }
        : item)),
    }))
  }

  /* ----------------------------------------------------------------- config */

  ensureConfig(): Promise<void> {
    if (this.configTask !== null) return this.configTask
    this.configTask = (async () => {
      try {
        const response = await fetch('/explainer/config', { method: 'GET' })
        if (!response.ok) throw new Error(`config ${response.status}`)
        const data = await response.json() as { config?: PublicConfig }
        const config = data?.config
        if (config !== undefined && typeof config === 'object') {
          this.emit({ config, ready: true })
          return
        }
        throw new Error('malformed config')
      } catch {
        this.emit({ ready: true })
      }
    })()
    return this.configTask
  }

  /* ------------------------------------------------------------------ bridge */

  setBridge(bridge: ComposerBridge | null): void {
    this.emit({ bridge })
  }

  setSessionId(sessionId: string | null): void {
    if (this.snap.sessionId !== sessionId) this.emit({ sessionId })
  }

  /** Mirror the main window's model so every ask uses the same route. */
  setSessionModel(model: { provider: string; model: string } | null): void {
    const current = this.snap.sessionModel
    if (current?.provider === model?.provider && current?.model === model?.model) return
    if (current === null && model === null) return
    this.emit({ sessionModel: model })
  }

  /** Transient one-line feedback (copied, inserted, errors with no anchor). */
  notify(text: string): void {
    this.noticeId += 1
    const id = this.noticeId
    this.emit({ notice: { id, text } })
    clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => {
      if (this.snap.notice?.id === id) this.emit({ notice: null })
    }, 1800)
  }

  /** Insert one answer into the main composer without submitting it. */
  insertToComposer(text: string): boolean {
    const bridge = this.snap.bridge
    if (bridge === null) return false
    if (bridge.insertText(text)) return true
    const draft = bridge.getDraft()
    bridge.setDraft(draft === '' ? text : `${draft}\n\n${text}`)
    return true
  }

  /** Hand the selection plus the question to the main conversation. */
  escalateToSession(): boolean {
    const card = this.snap.card
    const bridge = this.snap.bridge
    if (card === null || bridge === null) return false
    const answer = [...card.messages].reverse().find(item => item.role === 'assistant' && item.text !== '')
    const parts: string[] = []
    if (card.quote !== '') {
      parts.push(card.quote.split('\n').map(line => `> ${line}`).join('\n'))
    }
    if (card.lastQuestion !== '') parts.push(`我的问题：${card.lastQuestion}`)
    if (answer !== undefined) parts.push(`（刚才的快问只给了简答，请深入解释，必要时查代码。）`)
    bridge.setDraft(parts.join('\n\n'))
    return true
  }
}