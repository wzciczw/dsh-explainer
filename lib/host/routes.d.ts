import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ConnectionLike, ExplainerConfig, ModelCatalog } from './types.js';
import { AskEngine } from './engine.js';
import type { ThreadStore } from './threads.js';
/** Dependencies shared by the routes. */
export interface RouteDeps {
    config: ExplainerConfig;
    engine: AskEngine;
    threads: ThreadStore;
    connection: ConnectionLike | undefined;
    /**
     * The selectable models the main chat offers, plus the route the window uses
     * by default. Optional so a host without an `llm` catalog still serves the
     * ask route.
     */
    catalog?: () => Promise<ModelCatalog>;
}
/**
 * `GET /explainer/config` — the browser's view of the plugin row.
 *
 * The model catalog is merged in when available: `defaultModel` is the route
 * this window uses by default, and `groups` is what the main chat can select
 * from, so a deployment can point the window at any of those models.
 */
export declare function configHandler(deps: RouteDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/** `GET /explainer/models` — the selectable models and the window's default route. */
export declare function modelsHandler(deps: RouteDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
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
