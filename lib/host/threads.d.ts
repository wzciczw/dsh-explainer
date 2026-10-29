import type { ThreadMessage } from './types.js';
/** One isolated quick-ask conversation, held in host memory only. */
export interface Thread {
    readonly id: string;
    createdAt: number;
    lastUsed: number;
    messages: ThreadMessage[];
    model?: {
        provider: string;
        model: string;
    };
    inheritContext: boolean;
    /** Selection this thread was opened with, reused for per-turn file grounding. */
    selection: string;
    /** The read-only conversation snapshot, reused for per-turn file grounding. */
    contextText: string;
    /** Session workspace root, the only tree file grounding may read. */
    cwd?: string;
    /** Characters of the read-only main-session snapshot copied into the opening turn. */
    contextChars: number;
    turns: number;
}
/**
 * Bounded, TTL'd thread table.
 *
 * Quick-ask threads are deliberately never persisted: close the page or let
 * the TTL expire and the isolated conversation is gone, while the main session
 * log never contained it in the first place.
 */
export declare class ThreadStore {
    private readonly maxThreads;
    private readonly ttlMs;
    private readonly map;
    constructor(maxThreads: number, ttlMs: number);
    /** Read a live thread and refresh its LRU position. */
    get(id: string, now: number): Thread | undefined;
    /** Insert a fresh thread, evicting the least recently used beyond the cap. */
    create(thread: Thread): Thread;
    /** Drop one thread (panel gesture or cancellation of a failed creation). */
    remove(id: string): void;
    /** Drop expired threads and enforce the size cap; returns the live count. */
    prune(now: number): number;
    /** Live thread count, for the config endpoint and diagnostics. */
    size(): number;
}
