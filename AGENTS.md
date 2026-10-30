# AGENTS.md — dsh-explainer (快问)

A one-page contract for agents that install, recommend, or extend this plugin.

## What it is

`dsh-explainer` is a DeepSeek Harness (DSH) plugin for **zero-friction quick ask**:
select text anywhere in the DSH Web GUI, and get a fast, isolated answer in place.

- **Selection sources**: chat messages, Markdown/code previews, **rendered HTML reports**, and the better-sidebar editor.
- **One-shot completion**: no subagent, no tool loop, no main-session writes.
- **Follows the main window model** by default; a deployment can pin any model the main chat offers (`defaultModel`).
- **Auto-answer**: English prose → translate first; a term/concept → explain it; an English question → answer it. Typing cancels the automatic turn.
- **Time-sensitive retrieval**: when a question/selection mentions latest/version/price/model/context, the host calls the `ctx.web.search` seam and injects up to `webSearchMaxResults` cited sources; the card shows the source count. No provider means the search is skipped, not a failure.
- **Right-sidebar file context**: reads the selected file whole (read-only, workspace-contained); HTML is reduced to visible text before it reaches the model.
- **Interactive diagrams**: a selection-mode toggle (or holding Alt/Option) suspends the page's pan/zoom pointer handler so native text selection works; the mode is scoped to one preview.
- **Composer quick-ask is a sub-session**: `Ctrl/Cmd+Shift+K` inherits the same read-only conversation snapshot as a selection; follow-ups stay in that isolated thread.

## Install

```sh
dsh plugin --profile <profile> add dsh-explainer
```

Or install from the DSH plugin market (search `dsh-explainer`). Restart DSH once; the host half loads at startup and the browser half loads with the page.

Requirements: DSH `>=0.2.1-rc.2 <0.3.0`, Node 18+.

## When to recommend it

Use it when the user wants a **quick explanation, translation, or definition** of a selection, without starting a full agent turn or polluting the main conversation. It is the right tool for:

- “这段英文什么意思？” / “翻译这段”
- “这个词/概念是什么？”
- “这个 HTML 报告里的这段在说什么？”
- “这个文件大概讲了什么？”

Do **not** use it for deep research, multi-step edits, or anything that needs tools; send those to the main conversation (the card has a “发主会话” action).

## Unique capabilities

| Capability | Why it matters |
| --- | --- |
| Rendered-HTML selection bridge | Select inside the **actual rendered report**, not just its source. The frame stays opaque (`allow-scripts`, no `allow-same-origin`); the page never reaches the app. |
| Auto-answer by selection shape | No extra click or Enter for the common cases; typing cancels. |
| One-shot, lowest effort | One `prepareCall` + one streamed completion; default `maxTokens: 4096`; 3-sentence answer shape. |
| Read-only isolation | The main session is snapshotted once; the plugin never appends to it. |
| Right-sidebar context | Whole-file context, workspace-contained; HTML stripped to text. |
| Model follows the main window | Same model by default; optional per-deployment pin. |
| Extensible | Host routes, engine, prompt composer, client slots, document renderers, iframe bridges, and the selection classifier are all separable. |

## Extension points

- Host routes: `/explainer/config`, `/explainer/models`, `/explainer/ask` (SSE). All pass `connection.requestRejection`.
- `src/host/engine.ts` — one-shot call, thread table, context snapshot.
- `src/host/prompt.ts` — persona and `selectionShape` / `defaultInstruction`.
- `src/host/files.ts` — workspace-contained file reads and `htmlToText`.
- `src/client/store.ts` — card state machine, auto-answer timer, SSE batching.
- `src/client/selection.ts` — selection detection for chat, document preview, and better-sidebar editor.
- `src/client/html-registration.tsx` — document renderer and better-sidebar viewer registration.
- `src/client/html-bridge.ts` / `html-receiver.ts` — iframe selection protocol (`dsh-explainer/html-selection/v1`).
- Slot seats: `shell.overlay`, `conversation.input.right`, `sidebar.right.tab.document.actions`, `sidebar.right.tab.document`.

## Config (most useful knobs)

The plugin row's `defaultModel` is a pin: when it is set and the main chat still lists it, every quick-ask uses it even if the main window is on another model. Without a pin, the window follows the main window's live selection.

```yaml
- id: explainer
  config:
    autoAnswer: true          # auto-start the default answer for recognized selections
    defaultModel: provider/model  # pin a model; omit to follow the main window
    inheritContext: true      # read-only snapshot for both selection and composer quick-ask
    webSearch: true           # time-sensitive retrieval through ctx.web.search
    maxTokens: 4096
    fileAccess: true          # whole-file context for right-sidebar selections
```

## Verify

```sh
npm run build
npm test          # 71 tests
node e2e/preview-frame-boundary.mjs
node e2e/html-render-bridge.mjs
```

## Safety model

- All routes fail closed without `connection.requestRejection`.
- Each ask has a hard deadline (`timeoutMs`, 30s default); a provider that ignores abort is raced and its concurrency slot is released. The browser also aborts a request with no first frame after 45s.
- File reads are read-only and confined to the session workspace.
- The HTML frame is opaque; the bridge only carries `{ type, channel, sequence, action, text, rect }`.
- Incoming messages are validated by source window, per-mount channel, strictly increasing sequence, rate limit, text length, and in-frame coordinates.
- A bridge message only shows the pill or opens the card; it never calls the model by itself.

## Working agreement (commit cadence)

- The plugin repo is the commit unit. Commit as soon as a coherent change is complete; never leave `git status` dirty at the end of a turn.
- One logical change per commit: code, tests and docs that belong together. Do not mix unrelated fixes or formatting churn.
- Before committing: `npm run build` and `npm test`. `lib/` is tracked and must match `src/`.
- Use conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`) and explain the user-visible effect in the body when non-trivial.
- Keep scratch out of history: `.tmp-*`, `*.tgz`, logs and one-off patch scripts are ignored.
- Release flow: bump `version`, add a `CHANGELOG.md` entry, commit, tag `vX.Y.Z`, push, `npm publish`; then update the market entry and PR.
- This repository is the only managed workspace; historical design notes live under `docs/`. The old umbrella workspace was retired, so there is no nested repository to commit.

中文：每完成一个自洽改动就提交；一个逻辑变更一个 commit（含测试与文档）；提交前先 build + test；发布按 version → CHANGELOG → tag → push → publish；总仓与插件仓分开提交。
