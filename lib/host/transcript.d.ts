import type { SessionsServiceLike } from './types.js';
/** One recovered conversation turn from the main session log. */
export interface TranscriptTurn {
    role: 'user' | 'assistant';
    text: string;
}
/** Read-only context snapshot handed to the quick-ask thread. */
export interface TranscriptSnapshot {
    text: string;
    model?: {
        provider: string;
        model: string;
    };
    turns: number;
    chars: number;
}
/**
 * Reconstruct the newest conversation turns from the session event log,
 * newest-first so a long history never costs more than the budget we use.
 *
 * This is a READ. The snapshot is copied into the quick-ask thread and the
 * main session is never appended to, which is the whole isolation contract.
 */
export declare function readTranscript(sessions: SessionsServiceLike | undefined, sessionId: string | undefined, maxMessages: number, maxChars: number): TranscriptSnapshot;
/** The session workspace root, or undefined when the session cannot be read. */
export declare function readSessionCwd(sessions: SessionsServiceLike | undefined, sessionId: string | undefined): string | undefined;
/**
 * Read only the model route the main session used last, without rebuilding a
 * transcript. Kept separate from {@link readTranscript} because a one-message
 * budget can stop the turn scan before it reaches the newest header.
 */
export declare function readSessionModel(sessions: SessionsServiceLike | undefined, sessionId: string | undefined): {
    provider: string;
    model: string;
} | undefined;
