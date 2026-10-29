import type {
  DefaultModelLike,
  ExplainerConfig,
  HostContextLike,
  LlmServiceLike,
  ModelCatalog,
  ModelRoute,
  SessionsServiceLike,
} from './types.js'
import { readSessionModel } from './transcript.js'

/** Upper bounds so one unusual provider cannot stall or flood the browser. */
const PROVIDER_TIMEOUT_MS = 2_500
const CATALOG_TIMEOUT_MS = 6_000
const MAX_PROVIDERS = 24
const MAX_MODELS_PER_PROVIDER = 200

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
    timer.unref?.()
  })
  return Promise.race([task, guard]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

function routeOf(value: { provider?: unknown; model?: unknown } | null | undefined): ModelRoute | undefined {
  if (value === null || value === undefined) return undefined
  const { provider, model } = value
  if (typeof provider !== 'string' || provider === '') return undefined
  if (typeof model !== 'string' || model === '') return undefined
  return { provider, model }
}

/**
 * The deployment-wide default route (`agentDefaultModel`). This is what a new
 * main-chat session starts on before anyone picks a different model, so it is
 * the natural fallback for "the main chat's model" when a session has not made
 * its own choice yet.
 */
export function readDeploymentDefault(ctx: HostContextLike): ModelRoute | undefined {
  try {
    const service = ctx.get?.('agentDefaultModel') as DefaultModelLike | undefined
    return routeOf(service?.currentSelection?.())
  } catch {
    return undefined
  }
}

/**
 * The route a quick-ask window uses by default.
 *
 * Precedence:
 *   1. `defaultModel` from the plugin row — an explicit opt-in to a model the
 *      main chat may also offer, chosen per deployment.
 *   2. the main session's own last route (the product rule: follow the main
 *      window), read-only;
 *   3. the deployment default (`agentDefaultModel`);
 *   4. the first advertised provider/model.
 *
 * This is the same precedence the engine applies to a request that carries no
 * explicit route; the browser only mirrors it to label the window.
 */
export async function resolveDefaultRoute(input: {
  ctx: HostContextLike
  llm: LlmServiceLike
  config: ExplainerConfig
  sessions?: SessionsServiceLike | undefined
  sessionId?: string | undefined
}): Promise<ModelRoute | undefined> {
  if (input.config.defaultModel !== undefined) return input.config.defaultModel
  const sessionRoute = readSessionModel(input.sessions, input.sessionId)
  if (sessionRoute !== undefined) return sessionRoute
  const deployment = readDeploymentDefault(input.ctx)
  if (deployment !== undefined) return deployment
  return firstAdvertised(input.llm)
}

/** First provider/model a registered adapter advertises (last-resort route). */
export async function firstAdvertised(llm: LlmServiceLike): Promise<ModelRoute | undefined> {
  const providers = llm.listProviders?.() ?? []
  const first = providers[0]
  if (first === undefined) return undefined
  try {
    const models = (await llm.listModels?.(first.id)) ?? []
    const model = models[0]
    return model === undefined ? undefined : { provider: first.id, model: model.id }
  } catch {
    return undefined
  }
}

/**
 * Every model the main chat can select from, grouped by provider.
 *
 * Read-only: this only asks the registered adapters what they advertise
 * (`listProviders` + `listModels`), exactly like the model picker does. A
 * provider that hangs or throws yields an empty group instead of failing the
 * whole catalog, and every call is bounded in time.
 */
export async function listModelCatalog(ctx: HostContextLike, llm: LlmServiceLike): Promise<ModelCatalog> {
  const defaultRoute = readDeploymentDefault(ctx) ?? null
  const providers = (llm.listProviders?.() ?? []).slice(0, MAX_PROVIDERS)
  const groups = await Promise.all(providers.map(async provider => {
    const name = typeof provider.name === 'string' && provider.name !== '' ? provider.name : provider.id
    if (typeof llm.listModels !== 'function') return { id: provider.id, name, models: [] }
    try {
      const listed = await withTimeout(Promise.resolve(llm.listModels(provider.id)), PROVIDER_TIMEOUT_MS)
      const models = (Array.isArray(listed) ? listed : [])
        .filter((model): model is { id: string; name?: string } => typeof model?.id === 'string' && model.id !== '')
        .slice(0, MAX_MODELS_PER_PROVIDER)
        .map(model => ({
          id: model.id,
          name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id,
        }))
      return { id: provider.id, name, models }
    } catch {
      return { id: provider.id, name, models: [] }
    }
  }))
  return {
    defaultRoute,
    groups: groups.filter(group => group.models.length > 0),
  }
}

/** Bounded wrapper shared by the route handlers. */
export function catalogWithin(catalog: Promise<ModelCatalog>): Promise<ModelCatalog> {
  return withTimeout(catalog, CATALOG_TIMEOUT_MS)
}
