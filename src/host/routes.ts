import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AskRequest, ConnectionLike, ExplainerConfig, ModelCatalog } from './types.js'
import { publicConfig } from './config.js'
import { AskEngine, AskError } from './engine.js'
import type { ThreadStore } from './threads.js'

const BODY_LIMIT = 128 * 1024

/** Dependencies shared by the routes. */
export interface RouteDeps {
  config: ExplainerConfig
  engine: AskEngine
  threads: ThreadStore
  connection: ConnectionLike | undefined
  /**
   * The selectable models the main chat offers, plus the route the window uses
   * by default. Optional so a host without an `llm` catalog still serves the
   * ask route.
   */
  catalog?: () => Promise<ModelCatalog>
}

class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** The deployment trust fence. Fails closed when the connection service is absent. */
function trusted(deps: RouteDeps, req: IncomingMessage): boolean {
  const connection = deps.connection
  if (connection?.requestRejection === undefined) return false
  try {
    return connection.requestRejection(req) === undefined
  } catch {
    return false
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function sendFailure(res: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    sendJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof AskError) {
    sendJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  sendJson(res, 500, { ok: false, error: { code: 'internal', message } })
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > BODY_LIMIT) throw new HttpError('too-large', 'request body is too large', 413)
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') throw new HttpError('bad-request', 'request body is required', 400)
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError('bad-request', 'request body must be JSON', 400)
  }
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\u0000/g, '').slice(0, max)
}

/** Clamp untrusted fields into the bounded request the engine accepts. */
function parseAsk(body: unknown, config: ExplainerConfig): AskRequest {
  if (body === null || typeof body !== 'object') throw new HttpError('bad-request', 'body must be an object', 400)
  const raw = body as Record<string, unknown>
  const mode = raw.mode === 'quick' ? 'quick' : raw.mode === 'selection' ? 'selection' : undefined
  if (mode === undefined) throw new HttpError('bad-request', 'mode must be selection or quick', 400)
  const threadId = text(raw.threadId, 128)
  if (threadId === '') throw new HttpError('bad-request', 'threadId is required', 400)
  return {
    threadId,
    mode,
    question: text(raw.question, 4_000),
    selection: text(raw.selection, config.selectionMaxChars),
    ...(typeof raw.filePath === 'string' && raw.filePath !== '' && raw.filePath.length <= 2_048
      ? { filePath: raw.filePath }
      : {}),
    ...(typeof raw.sessionId === 'string' && raw.sessionId !== '' && raw.sessionId.length <= 200
      ? { sessionId: raw.sessionId }
      : {}),
    inheritContext: typeof raw.inheritContext === 'boolean' ? raw.inheritContext : config.inheritContext,
    ...(typeof raw.provider === 'string' && raw.provider !== '' && raw.provider.length <= 200
      ? { provider: raw.provider }
      : {}),
    ...(typeof raw.model === 'string' && raw.model !== '' && raw.model.length <= 200
      ? { model: raw.model }
      : {}),
    ...(typeof raw.preset === 'string' && raw.preset.length <= 40 ? { preset: raw.preset } : {}),
  }
}

/** Write one named SSE frame. */
function sse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * `GET /explainer/config` — the browser's view of the plugin row.
 *
 * The model catalog is merged in when available: `defaultModel` is the route
 * this window uses by default, and `groups` is what the main chat can select
 * from, so a deployment can point the window at any of those models.
 */
export function configHandler(deps: RouteDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!trusted(deps, req)) {
      sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: { code: 'method', message: 'method not allowed' } })
      return
    }
    const config = publicConfig(deps.config)
    let catalog: ModelCatalog = { defaultRoute: null, groups: [] }
    if (deps.catalog !== undefined) {
      try {
        catalog = await deps.catalog()
      } catch {
        // A failing catalog must not break the card: the window then simply
        // does not label a default model.
      }
    }
    sendJson(res, 200, {
      ok: true,
      config: {
        ...config,
        // The plugin pin is the window default; the deployment default is only
        // the fallback when no pin is configured.
        defaultModel: deps.config.defaultModel ?? catalog.defaultRoute ?? null,
        pinnedModel: deps.config.defaultModel ?? null,
        modelGroups: catalog.groups,
      },
      threads: deps.threads.size(),
      version: 2,
    })
  }
}

/** `GET /explainer/models` — the selectable models and the window's default route. */
export function modelsHandler(deps: RouteDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!trusted(deps, req)) {
      sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: { code: 'method', message: 'method not allowed' } })
      return
    }
    if (deps.catalog === undefined) {
      sendJson(res, 503, { ok: false, error: { code: 'no-catalog', message: 'no model catalog is available' } })
      return
    }
    try {
      const catalog = await deps.catalog()
      sendJson(res, 200, {
        ok: true,
        defaultModel: deps.config.defaultModel ?? catalog.defaultRoute ?? null,
        groups: catalog.groups,
      })
    } catch (error) {
      sendJson(res, 503, {
        ok: false,
        error: {
          code: 'no-catalog',
          message: error instanceof Error ? error.message : 'the model catalog is unavailable',
        },
      })
    }
  }
}

/**
 * `POST /explainer/ask` — SSE stream of one quick-ask turn.
 *
 * Frames: `meta` (route + inherited context size), `delta` (visible text),
 * `done` (timing and usage), `error` (typed refusal). The response starts only
 * after validation, so a bad request still answers with a normal JSON status.
 */
export function askHandler(deps: RouteDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!trusted(deps, req)) {
      sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: { code: 'method', message: 'method not allowed' } })
      return
    }

    let request: AskRequest
    try {
      request = parseAsk(await readJson(req), deps.config)
    } catch (error) {
      sendFailure(res, error)
      return
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, deps.config.timeoutMs)
    const onClose = (): void => controller.abort()
    res.on('close', onClose)
    // Heartbeats keep intermediaries and the browser from idling the stream
    // out during a long first token; comments are ignored by EventSource
    // parsers and by our fetch reader.
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n')
    }, 15_000)

    writeSseHead(res)

    try {
      const outcome = await deps.engine.run(
        request,
        controller.signal,
        (delta) => {
          if (!res.writableEnded) sse(res, 'delta', { text: delta })
        },
        (meta) => {
          if (!res.writableEnded) sse(res, 'meta', meta)
        },
      )
      if (!res.writableEnded) {
        sse(res, 'done', {
          ms: outcome.ms,
          chars: outcome.chars,
          provider: outcome.provider,
          model: outcome.model,
          ...(outcome.effort === undefined ? {} : { effort: outcome.effort }),
          ...(outcome.usage === undefined ? {} : { usage: outcome.usage }),
        })
      }
    } catch (error) {
      if (res.writableEnded) return
      if (controller.signal.aborted) {
        sse(res, 'error', {
          code: timedOut ? 'timeout' : 'aborted',
          message: timedOut ? 'the answer timed out' : 'the answer was stopped',
        })
        return
      }
      if (error instanceof AskError) {
        sse(res, 'error', { code: error.code, message: error.message })
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      sse(res, 'error', { code: 'internal', message })
    } finally {
      clearTimeout(timer)
      clearInterval(heartbeat)
      res.off('close', onClose)
      if (!res.writableEnded) res.end()
    }
  }
}

/**
 * Write the SSE preamble for an answer. Exported so the client-facing tests can
 * assert the exact header set without opening a socket.
 */
export function writeSseHead(res: ServerResponse): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.flushHeaders?.()
  res.socket?.setNoDelay(true)
}