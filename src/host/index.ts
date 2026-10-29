import type { HostPluginContext, LlmServiceLike } from './types.js'
import { normalizeConfig } from './config.js'
import { AskEngine } from './engine.js'
import { ThreadStore } from './threads.js'
import { askHandler, configHandler, modelsHandler, type RouteDeps } from './routes.js'
import { catalogWithin, listModelCatalog, resolveDefaultRoute } from './models.js'

/** Loader row name; must equal the installed package name. */
export const name = 'explainer'

/** The host half needs a model service, a web server for the SSE route and the trust fence. */
export const inject = ['llm', 'webServer', 'connection']

interface WebServerLike {
  register: (route: { kind: 'exact' | 'prefix'; path: string; handler: (req: unknown, res: unknown) => unknown }) => () => void
}

/**
 * Host half of the 快问 plugin.
 *
 * It owns three things: the bounded in-memory thread table, the one-shot model
 * call (no agent loop, no tools), and the streaming HTTP route the browser
 * half reads. The main Session log is read once per thread for context and is
 * never written to.
 */
export function apply(ctx: HostPluginContext, rawConfig: unknown): void {
  const config = normalizeConfig(rawConfig)
  if (!config.enabled) {
    ctx.logger?.info?.('explainer: disabled by config')
    return
  }

  const llm = ctx.get?.('llm') as LlmServiceLike | undefined
  const webServer = ctx.get?.('webServer') as WebServerLike | undefined
  const connection = ctx.connection ?? (ctx.get?.('connection') as RouteDeps['connection'])
  if (llm === undefined || typeof llm.prepareCall !== 'function') {
    ctx.logger?.warn?.('explainer: the llm service is unavailable; the plugin stays inert')
    return
  }
  if (webServer === undefined || typeof webServer.register !== 'function') {
    ctx.logger?.warn?.('explainer: the webServer service is unavailable; the plugin stays inert')
    return
  }

  const threads = new ThreadStore(config.maxThreads, config.threadTtlMs)
  const engine = new AskEngine(ctx, llm, threads, config)
  const deps: RouteDeps = {
    config,
    engine,
    threads,
    connection,
    // Resolved per request, never frozen: the model catalog and the deployment
    // default can change while the plugin is running.
    catalog: () => catalogWithin(listModelCatalog(ctx, llm)),
  }

  ctx.effect?.(() => webServer.register({
    kind: 'exact',
    path: '/explainer/config',
    handler: configHandler(deps) as unknown as (req: unknown, res: unknown) => unknown,
  }), 'explainer: config route')

  ctx.effect?.(() => webServer.register({
    kind: 'exact',
    path: '/explainer/models',
    handler: modelsHandler(deps) as unknown as (req: unknown, res: unknown) => unknown,
  }), 'explainer: models route')

  ctx.effect?.(() => webServer.register({
    kind: 'exact',
    path: '/explainer/ask',
    handler: askHandler(deps) as unknown as (req: unknown, res: unknown) => unknown,
  }), 'explainer: ask route')

  // Evict expired isolated threads even if the user never asks again.
  const timer = setInterval(() => {
    try {
      threads.prune(Date.now())
    } catch {
      // A pruning failure must never take the host down.
    }
  }, 60_000)
  timer.unref?.()
  ctx.effect?.(() => () => clearInterval(timer), 'explainer: thread prune timer')

  const pinned = config.defaultModel === undefined
    ? 'session/default'
    : `${config.defaultModel.provider}/${config.defaultModel.model}`
  ctx.logger?.info?.(
    `explainer: ready (model=${pinned}, inheritContext=${config.inheritContext}, maxTokens=${config.maxTokens})`,
  )
}