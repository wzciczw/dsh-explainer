import type { ExplainerConfig, ModelRoute } from './types.js'

/** Conservative default preset labels, localized on the client. */
export const DEFAULT_PRESETS = ['explain', 'translate', 'summary', 'example'] as const

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function presets(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_PRESETS]
  const ids = value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item !== '')
  return ids.length > 0 ? [...new Set(ids)].slice(0, 8) : [...DEFAULT_PRESETS]
}

/**
 * Parse the window's default model. Accepted forms:
 *   - `provider/model` (the first slash splits provider from model, so model
 *     ids may themselves contain slashes, e.g. `newapi/stepfun/step-5-preview`)
 *   - `{ provider, model }`
 * A bare `model` is accepted only when the plugin row also pins `provider`;
 * otherwise the route is ambiguous and the window keeps following the main chat.
 */
function defaultModel(
  value: unknown,
  fallbackProvider: string | undefined,
): ModelRoute | undefined {
  let provider: string | undefined
  let model: string | undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const slash = trimmed.indexOf('/')
    if (slash > 0 && slash < trimmed.length - 1) {
      provider = trimmed.slice(0, slash).trim()
      model = trimmed.slice(slash + 1).trim()
    } else if (trimmed !== '') {
      model = trimmed
    }
  } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as Record<string, unknown>
    provider = str(source.provider)
    model = str(source.model)
  }
  if (model === undefined) return undefined
  if (model.length > 200) return undefined
  const resolved = provider ?? fallbackProvider
  if (resolved === undefined || resolved === '' || resolved.length > 200) return undefined
  return { provider: resolved, model }
}

/**
 * Normalize the plugin row config into the bounded shape the engine uses.
 * Every bound is enforced here so a bad profile value cannot make one ask
 * hang the host or blow the provider context window.
 */
export function normalizeConfig(raw: unknown): ExplainerConfig {
  const source = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const provider = str(source.provider)
  const pinnedDefault = defaultModel(source.defaultModel, provider) ?? defaultModel(source.model, provider)
  return {
    enabled: bool(source.enabled, true),
    ...(provider === undefined ? {} : { provider }),
    ...(str(source.model) === undefined ? {} : { model: str(source.model) }),
    ...(pinnedDefault === undefined ? {} : { defaultModel: pinnedDefault }),
    ...(str(source.reasoningEffort) === undefined ? {} : { reasoningEffort: str(source.reasoningEffort) }),
    maxTokens: int(source.maxTokens, 800, 64, 8192),
    temperature: num(source.temperature, 0.3, 0, 2),
    timeoutMs: int(source.timeoutMs, 30_000, 3_000, 180_000),
    selectionMaxChars: int(source.selectionMaxChars, 6_000, 200, 40_000),
    contextMaxChars: int(source.contextMaxChars, 8_000, 0, 40_000),
    contextMaxMessages: int(source.contextMaxMessages, 8, 0, 40),
    maxTurns: int(source.maxTurns, 3, 1, 20),
    maxThreads: int(source.maxThreads, 40, 4, 500),
    threadTtlMs: int(source.threadTtlMs, 30 * 60_000, 60_000, 24 * 60 * 60_000),
    inheritContext: bool(source.inheritContext, true),
    showMeta: bool(source.showMeta, true),
    maxConcurrent: int(source.maxConcurrent, 4, 1, 16),
    rightClick: bool(source.rightClick, true),
    autoAnswer: bool(source.autoAnswer, true),
    fileAccess: bool(source.fileAccess, true),
    fileContextMaxChars: int(source.fileContextMaxChars, 20_000, 0, 60_000),
    fileMaxFiles: int(source.fileMaxFiles, 4, 0, 12),
    fileMaxChars: int(source.fileMaxChars, 12_000, 0, 40_000),
    fileExcerptChars: int(source.fileExcerptChars, 4_000, 0, 16_000),
    presets: presets(source.presets),
  }
}

/** The subset the browser needs to render the card. Never includes secrets. */
export function publicConfig(config: ExplainerConfig): Record<string, unknown> {
  return {
    enabled: config.enabled,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    selectionMaxChars: config.selectionMaxChars,
    contextMaxChars: config.contextMaxChars,
    contextMaxMessages: config.contextMaxMessages,
    maxTurns: config.maxTurns,
    inheritContext: config.inheritContext,
    showMeta: config.showMeta,
    rightClick: config.rightClick,
    autoAnswer: config.autoAnswer,
    fileAccess: config.fileAccess,
    fileContextMaxChars: config.fileContextMaxChars,
    presets: config.presets,
    provider: config.provider ?? null,
    model: config.model ?? null,
    defaultModel: config.defaultModel ?? null,
  }
}