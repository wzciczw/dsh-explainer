import type { HostPluginContext } from './types.js';
/** Loader row name; must equal the installed package name. */
export declare const name = "explainer";
/** The host half needs a model service, a web server for the SSE route and the trust fence. */
export declare const inject: string[];
/**
 * Host half of the 快问 plugin.
 *
 * It owns three things: the bounded in-memory thread table, the one-shot model
 * call (no agent loop, no tools), and the streaming HTTP route the browser
 * half reads. The main Session log is read once per thread for context and is
 * never written to.
 */
export declare function apply(ctx: HostPluginContext, rawConfig: unknown): void;
