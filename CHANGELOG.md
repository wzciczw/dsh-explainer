# Changelog

All notable changes to `dsh-explainer` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Time-sensitive questions can use the host web-search seam (`ctx.web.search`): up to four cited sources are injected as a bounded `[联网检索]` block, and the card shows `联网 N 源`. Without a search provider the answer proceeds without it.
- The better-sidebar path detector now falls back to the path input's value and to the nearest ancestor, covering native tabs that do not expose a marked host or a `title`.

### Fixed

- A model provider that ignores abort no longer pins a concurrency slot: the engine races each stream against `timeoutMs` and releases it; the browser aborts a request that receives no first frame after 45s.
- The pinned `defaultModel` now wins over the inherited main-window route: the config response exposes `pinnedModel`, the browser no longer mistakes the deployment default for a pin, and a send waits for the config before choosing a model.
- The persona now warns that model version/price/date knowledge may be stale and suggests verification, instead of asserting an old version is latest.
- Interactive HTML diagrams that start panning on `pointerdown` now support text selection: the renderer adds a 「划词模式」 toggle (or hold Alt/Option) that stops the page handler while leaving native selection intact.

### Changed

- Composer quick-ask (`Ctrl/Cmd+Shift+K`) now inherits the main conversation snapshot like a sub-session, instead of running stateless. `inheritContext: false` still disables it for both entry points.

## [0.3.0] - 2026-10-29

### Added

- Rendered-HTML selection: `.html` files now open in the plugin's own renderer by default, keeping the page's inline styles, scripts, data images and interactions inside an opaque sandbox (`allow-scripts`, no `allow-same-origin`). Selecting text in the rendered report shows the quick-ask pill; right-click opens the card.
- Auto-answer: a recognized English prose selection is translated first, a term/concept is explained, and an English question is answered, starting automatically after ~0.4s. Typing cancels it; `autoAnswer: false` disables it.
- Smarter concept detection: definition frames (`the concept of`, `what is`, `什么是`, `……的概念`) are stripped before classification, then finite-verb, word-count and sentence-count signals separate noun phrases from sentences.
- Model routing: follows the main window's model by default; `GET /explainer/models` exposes the main chat's catalog; `defaultModel` can pin any selectable model.
- better-sidebar editor support: selections carry the tab's file path, and the host reads the file whole (read-only, workspace-contained).
- `AGENTS.md` and a README section for agents: when to recommend the plugin, one-line install, extension points and safety boundaries.
- HTML context extraction: HTML files are reduced to visible text before reaching the model.

### Fixed

- The HTML preview frame now fills the sidebar body instead of the browser default 300×150.
- The same-origin preview bridge is now covered by tests; opaque sandbox frames remain rejected.

## [0.2.1] - 2026-10-29

### Added

- Selections inside the better-sidebar editor are recognized; the editor tab's path is read from its header.
- A document-toolbar "Ask" action for previews whose selection cannot be read (e.g. the built-in opaque HTML frame).

### Fixed

- Right-click and the floating pill work in the better-sidebar editor's CodeMirror contenteditable.

## [0.2.0] - 2026-10-29

### Added

- Right-sidebar file selections: the selected file is read whole (workspace-contained, read-only) and sent as primary context.
- File path badge in the card header.

## [0.1.0] - 2026-10-29

### Added

- Initial release: in-place selection pill, quick-ask window, one-shot completion, read-only context snapshot, follow-ups, model following the main window, file snapshots, insert/copy/send-to-main actions.
