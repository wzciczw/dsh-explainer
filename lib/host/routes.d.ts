import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ConnectionLike, ExplainerConfig } from './types.js';
import { AskEngine } from './engine.js';
import type { ThreadStore } from './threads.js';
/** Dependencies shared by the three routes. */
export interface RouteDeps {
    config: ExplainerConfig;
    engine: AskEngine;
    threads: ThreadStore;
    connection: ConnectionLike | undefined;
}
/** `GET /explainer/config` — the browser's view of the plugin row. */
export declare function configHandler(deps: RouteDeps): (req: IncomingMessage, res: ServerResponse) => void;
/**
 * `POST /explainer/ask` — SSE stream of one quick-ask turn.
 *
 * Frames: `meta` (route + inherited context size), `delta` (visible text),
 * `done` (timing and usage), `error` (typed refusal). The response starts only
 * after validation, so a bad request still answers with a normal JSON status.
 */
export declare function askHandler(deps: RouteDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/**
 * Write the SSE preamble for an answer. Exported so the client-facing tests can
 * assert the exact header set without opening a socket.
 */
export declare function writeSseHead(res: ServerResponse): void;
