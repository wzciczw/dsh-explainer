import type { ExplainerConfig } from './types.js';
/** Conservative default preset labels, localized on the client. */
export declare const DEFAULT_PRESETS: readonly ["explain", "translate", "summary", "example"];
/**
 * Normalize the plugin row config into the bounded shape the engine uses.
 * Every bound is enforced here so a bad profile value cannot make one ask
 * hang the host or blow the provider context window.
 */
export declare function normalizeConfig(raw: unknown): ExplainerConfig;
/** The subset the browser needs to render the card. Never includes secrets. */
export declare function publicConfig(config: ExplainerConfig): Record<string, unknown>;
