/** Minimal rectangle shared by selection detection and placement. */
export interface RectLike {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

/** One visible bubble in the quick-ask window. */
export interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
  streaming?: boolean
  error?: string
  errorCode?: string
}

/** Route and timing facts shown under an answer. */
export interface Meta {
  provider?: string
  model?: string
  effort?: string
  ms?: number
  contextChars?: number
}

export type Phase = 'input' | 'streaming' | 'answer'

/** The open quick-ask window. */
export interface CardState {
  mode: 'selection' | 'quick'
  quote: string
  /** Absolute path of the right-sidebar file this selection came from. */
  filePath?: string
  sessionId?: string
  anchor: RectLike
  phase: Phase
  messages: Turn[]
  draft: string
  meta: Meta | null
  inheritContext: boolean
  quoteExpanded: boolean
  threadId: string
  /** Set after the user drags the window; null means "anchored". */
  position: { x: number; y: number } | null
  /** Last question sent, used by retry/reset without re-reading the draft. */
  lastQuestion: string
}

/** The pill shown next to a live chat selection. */
export interface HintState {
  sessionId?: string
  text: string
  rect: RectLike
  /** Absolute path when the selection came from a right-sidebar file. */
  filePath?: string
}

/** One selectable `provider/model` route. */
export interface ModelRoute {
  provider: string
  model: string
}

/** One provider group of the model catalog `/explainer/config` reports. */
export interface ModelGroup {
  id: string
  name: string
  models: Array<{ id: string; name: string }>
}

/** Public configuration mirror served by GET /explainer/config. */
export interface PublicConfig {
  enabled: boolean
  maxTokens: number
  temperature: number
  selectionMaxChars: number
  contextMaxChars: number
  contextMaxMessages: number
  maxTurns: number
  inheritContext: boolean
  showMeta: boolean
  rightClick: boolean
  /** Start the default answer as soon as a recognized selection opens. */
  autoAnswer: boolean
  presets: string[]
  provider: string | null
  model: string | null
  /**
   * The route this window uses by default. `null` means "follow the main chat";
   * otherwise the plugin row pinned one of the main chat's selectable models.
   */
  defaultModel?: ModelRoute | null
  /**
   * The plugin row's pin verbatim, whether or not the catalog still lists it.
   * The badge uses this so it never disagrees with the host fallbacks.
   */
  pinnedModel?: ModelRoute | null
  /** Models the main chat can select from (adapter-advertised, read-only). */
  modelGroups?: ModelGroup[]
}

/** The session-scoped bridge published by the composer entry. */
export interface ComposerBridge {
  sessionId?: string
  getDraft: () => string
  insertText: (text: string) => boolean
  setDraft: (text: string) => void
}

/** Whole observable snapshot of the browser half. */
export interface Notice {
  id: number
  text: string
}

export interface Snapshot {
  hint: HintState | null
  card: CardState | null
  config: PublicConfig | null
  bridge: ComposerBridge | null
  /** Session resolved from the layout when no composer is mounted. */
  sessionId: string | null
  /** The main window's current model selection, mirrored from the composer projection. */
  sessionModel: { provider: string; model: string } | null
  /**
   * The route the window uses by default, resolved on the host: either the
   * main chat's model or a model the plugin row pinned. `null` until known.
   */
  defaultRoute: ModelRoute | null
  notice: Notice | null
  /** True after the first config fetch settled (successfully or not). */
  ready: boolean
}