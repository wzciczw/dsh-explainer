import type { AskRequest, ExplainerConfig, HostPluginContext, LlmServiceLike } from './types.js';
import type { ThreadStore } from './threads.js';
/** A refusal the SSE writer can serialize without leaking internals. */
export declare class AskError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status?: number);
}
/** Why one ask finished, for the SSE `done` frame. */
export interface AskOutcome {
    provider: string;
    model: string;
    effort?: string;
    ms: number;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
    chars: number;
}
/** One host-side ask engine shared by every thread. */
export declare class AskEngine {
    private readonly ctx;
    private readonly llm;
    private readonly threads;
    private readonly config;
    private active;
    constructor(ctx: HostPluginContext, llm: LlmServiceLike, threads: ThreadStore, config: ExplainerConfig);
    /** Number of in-flight completions (diagnostics). */
    inFlight(): number;
    /**
     * Run one turn and stream visible text through `onDelta`.
     *
     * The thread is created on first use from a read-only snapshot of the main
     * session, then only ever appended to in host memory. Nothing here writes to
     * the Session log.
     */
    run(request: AskRequest, signal: AbortSignal, onDelta: (text: string) => void, onMeta?: (meta: {
        provider: string;
        model: string;
        effort?: string;
        contextChars: number;
    }) => void): Promise<AskOutcome>;
    /** Keep the opening turn plus the newest follow-up turns. */
    private trim;
    /**
     * Resolve the exact route for this turn.
     *
     * Precedence: explicit request → the main session's last request header →
     * a continuing thread's own route → the plugin row's `defaultModel` →
     * legacy `provider`+`model` → the deployment default → the first advertised
     * provider/model. The last two exist so a fresh profile with one configured
     * provider still works without extra setup.
     */
    private resolveTarget;
    /** Lowest supported reasoning effort, unless the config pins one. */
    private selectEffort;
}
