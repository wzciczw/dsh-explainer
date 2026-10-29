import type { ExplainerConfig, HostContextLike, LlmServiceLike, ModelCatalog, ModelRoute, SessionsServiceLike } from './types.js';
/**
 * The deployment-wide default route (`agentDefaultModel`). This is what a new
 * main-chat session starts on before anyone picks a different model, so it is
 * the natural fallback for "the main chat's model" when a session has not made
 * its own choice yet.
 */
export declare function readDeploymentDefault(ctx: HostContextLike): ModelRoute | undefined;
/**
 * The route a quick-ask window uses by default.
 *
 * Precedence:
 *   1. `defaultModel` from the plugin row — an explicit opt-in to a model the
 *      main chat may also offer, chosen per deployment.
 *   2. the main session's own last route (the product rule: follow the main
 *      window), read-only;
 *   3. the deployment default (`agentDefaultModel`);
 *   4. the first advertised provider/model.
 *
 * This is the same precedence the engine applies to a request that carries no
 * explicit route; the browser only mirrors it to label the window.
 */
export declare function resolveDefaultRoute(input: {
    ctx: HostContextLike;
    llm: LlmServiceLike;
    config: ExplainerConfig;
    sessions?: SessionsServiceLike | undefined;
    sessionId?: string | undefined;
}): Promise<ModelRoute | undefined>;
/** First provider/model a registered adapter advertises (last-resort route). */
export declare function firstAdvertised(llm: LlmServiceLike): Promise<ModelRoute | undefined>;
/**
 * Every model the main chat can select from, grouped by provider.
 *
 * Read-only: this only asks the registered adapters what they advertise
 * (`listProviders` + `listModels`), exactly like the model picker does. A
 * provider that hangs or throws yields an empty group instead of failing the
 * whole catalog, and every call is bounded in time.
 */
export declare function listModelCatalog(ctx: HostContextLike, llm: LlmServiceLike): Promise<ModelCatalog>;
/** Bounded wrapper shared by the route handlers. */
export declare function catalogWithin(catalog: Promise<ModelCatalog>): Promise<ModelCatalog>;
