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
export {};
