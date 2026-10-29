/**
 * Structural view of the parts of the DSH host we touch.
 *
 * The plugin deliberately does not import `@deepseek-ai/*` at runtime: those
 * modules live in the harness's own module graph, and a third-party bundle
 * must stay loadable across minor releases. Everything below is the narrow
 * shape we depend on, probed with `ctx.get(...)` and validated at the call
 * site so a missing or changed service degrades to a typed refusal instead of
 * a crash.
 */
/** One text content block in a model message. */
export interface TextBlock {
    type: 'text';
    text: string;
}
/** Provider-neutral user input for one hand-built request. */
export interface UserInput {
    role: 'user';
    content: TextBlock[];
}
/** Provider-neutral assistant turn kept in a quick-ask thread. */
export interface AssistantInput {
    role: 'assistant';
    content: TextBlock[];
    id: string;
    source: {
        kind: 'model';
        provider: string;
        model: string;
    };
}
export type ThreadMessage = UserInput | AssistantInput;
/** One session event, narrowed to the fields we read. */
export interface SessionEventLike {
    type?: string;
    data?: {
        content?: unknown;
        message?: {
            content?: unknown;
        };
        interrupted?: boolean;
        header?: {
            config?: {
                provider?: string;
                model?: string;
            };
        };
    };
}
/** The Session object surface used for the read-only context snapshot. */
export interface SessionLike {
    header?: {
        cwd?: string;
        title?: string;
    };
    snapshotEvents?: () => readonly SessionEventLike[];
}
/** Host service registry (`ctx.get`). */
export interface HostContextLike {
    get?: (key: string) => unknown;
}
/** `ctx.sessions` — the live session store. */
export interface SessionsServiceLike {
    get?: (id: string) => SessionLike | undefined;
}
/** One prepared model call, as returned by `ctx.llm.prepareCall`. */
export interface PreparedCallLike {
    config: {
        provider: string;
        model: string;
        reasoningEffort?: string;
        maxTokens?: number;
        temperature?: number;
    };
    stream: (options: Record<string, unknown>) => AsyncIterable<StreamChunkLike>;
}
/** Raw chunk vocabulary; only the variants we consume are listed. */
export type StreamChunkLike = {
    type: 'text-delta';
    index: number;
    text: string;
} | {
    type: 'reasoning-delta';
    index: number;
    text: string;
} | {
    type: 'finish';
    reason: {
        kind: string;
        failure?: {
            message?: string;
            code?: string;
        };
    };
} | {
    type: 'usage';
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
} | {
    type: string;
};
/** `ctx.llm` — the streaming model-call service. */
export interface LlmServiceLike {
    prepareCall: (config: {
        provider: string;
        model: string;
        maxTokens?: number;
        temperature?: number;
        reasoningEffort?: string;
    }, signal?: AbortSignal, configure?: (controls: {
        reasoningEffort?: string;
        temperature?: number;
        maxTokens?: number;
    }, model: {
        reasoning?: {
            efforts?: ReadonlyArray<{
                id: string;
            }>;
            defaultEffort?: string;
        };
    }) => {
        reasoningEffort?: string;
        temperature?: number;
        maxTokens?: number;
    }) => Promise<PreparedCallLike>;
    listProviders?: () => ReadonlyArray<{
        id: string;
        name?: string;
    }>;
    listModels?: (provider: string) => Promise<ReadonlyArray<{
        id: string;
        name?: string;
    }>>;
}
/** `ctx.agentDefaultModel` — optional fallback route. */
export interface DefaultModelLike {
    currentSelection?: () => {
        provider?: string;
        model?: string;
        reasoningEffort?: string;
    };
}
/** `ctx.connection` — the deployment trust fence. */
export interface ConnectionLike {
    requestRejection?: (req: unknown) => unknown;
}
/** The host plugin context surface we consume. */
export interface HostPluginContext extends HostContextLike {
    effect?: (fn: () => unknown, label?: string) => unknown;
    inject?: (keys: string[], fn: (child: HostContextLike) => unknown) => unknown;
    logger?: {
        info?: (msg: string) => void;
        warn?: (msg: string) => void;
        debug?: (msg: string) => void;
    };
    connection?: ConnectionLike;
}
/** One ask request as it arrives over the wire. */
export interface AskRequest {
    threadId: string;
    mode: 'selection' | 'quick';
    question: string;
    selection?: string;
    /** Absolute path of a right-sidebar file the selection came from. */
    filePath?: string;
    sessionId?: string;
    inheritContext?: boolean;
    provider?: string;
    model?: string;
    preset?: string;
}
/** Normalized plugin configuration (see `normalizeConfig`). */
export interface ExplainerConfig {
    enabled: boolean;
    provider?: string;
    model?: string;
    reasoningEffort?: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
    selectionMaxChars: number;
    contextMaxChars: number;
    contextMaxMessages: number;
    maxTurns: number;
    maxThreads: number;
    threadTtlMs: number;
    inheritContext: boolean;
    showMeta: boolean;
    maxConcurrent: number;
    rightClick: boolean;
    fileAccess: boolean;
    fileContextMaxChars: number;
    fileMaxFiles: number;
    fileMaxChars: number;
    fileExcerptChars: number;
    presets: string[];
}
