# dsh-explainer（快问）插件设计方案

> 状态：设计稿，待确认后实现
> 目标运行时：DeepSeek Harness Web GUI（0.2.1-rc.x）
> 插件名：`dsh-explainer`；UI 名称：**快问**；两种模式：**划词问** / **快问**

---

## 1. 一句话

在 DSH 的对话里选中任意一段文字，就地弹出“快问”卡片：可以加一句自己的问题，也可以一键“解释这段”；模型以**低思考、解释性**的方式流式回一段短答案。不选文字时，同一个卡片也能当“快问框”用。答案**不进入主会话历史**，需要深入时一键转交主会话。

---

## 2. 目标与非目标

### 目标

1. **不离开对话**：划词 → 提问 → 读答案，全程在当前页面完成，不跳转、不新开面板。
2. **快**：单次模型调用，不走 agent loop、不挂工具、不带会话历史；reasoning effort 取最低可用档；首 token 尽快出现。
3. **解释性**：输出短、先给结论、像同事随口解释，而不是一份报告。
4. **不污染**：快问的问答默认不写入当前 Session 日志，不打断主对话的上下文与缓存。
5. **两种入口一张卡**：划词问（带引用）与快问（空引用）共用同一个卡片和同一套状态。
6. **可升级**：答案不满意时，把“选段 + 问题”交给主会话继续深答。

### 非目标（v1 不做）

- 不做 agent：不读文件、不调工具、不联网搜索、不执行命令。
- 不做长期会话：关掉卡片即丢弃；不做跨刷新持久化（v2 可选）。
- 不做图片输入、多选、跨消息多段引用。
- 不替换、不接管主输入框的提交行为。
- 不做后端多用户/共享；纯本机、纯单页。

---

## 3. 交互设计

### 3.1 模式 A：划词问

```
┌ 对话 ────────────────────────────────────────────────┐
│  assistant                                            │
│  LayerFS 的 Branch 是廉价的：fork 出一个分支后，       │
│  每个 Commit 只记录差异，合并时才做三方合并。           │
│                    ▲                                  │
│                    │ 选中这段（真实 DOM 选区）        │
│                    └──────────┐                       │
│                               │                       │
│                        ┌──────▼───────┐               │
│                        │ ✦ 问这段     │  ← 悬浮胶囊   │
│                        └──────┬───────┘               │
└───────────────────────────────┼───────────────────────┘
                                │ 点击 / ⌘⇧E
                     ┌──────────▼───────────────┐
                     │ ✦ 问这段            ✕    │
                     │ ┌──────────────────────┐ │
                     │ │“LayerFS 的 Branch …” │ │ ← 引用 chip（可展开）
                     │ └──────────────────────┘ │
                     │ [解释] [翻译] [总结] [举例]│ ← 预设
                     │ ┌──────────────────────┐ │
                     │ │ 想问什么？（回车即问）│ │ ← 输入
                     │ └──────────────────────┘ │
                     │              ⏎ 发送  Esc │
                     └──────────┬───────────────┘
                                │ 发送
                     ┌──────────▼───────────────┐
                     │ ✦ 已选 34 字 · 解释      │
                     │ 分支很便宜：fork 只复制   │
                     │ 指针，Commit 是增量。     │ ← 流式答案
                     │ ▍                        │
                     │ ──────────────────────── │
                     │ 复制 插入输入框 追问 发主会话│
                     └──────────────────────────┘
```

要点：

- 选区成立后（鼠标松开、非空、长度 2–6000 字、落在对话区、不在输入框里），约 200ms 后在**选区末行下方**浮出胶囊。
- 胶囊只占很小面积，不遮挡选区；点击或 `⌘/Ctrl+Shift+E` 展开卡片。
- 卡片默认锚在选区下方 8px；下方空间不足则翻到上方；始终夹在视口内（12px 边距）。
- 引用 chip 只显示前 2 行，可展开全文；显示字数。
- 预设按钮把问题填进输入框并直接发送（“解释”等价于空问题直接回车）。
- 输入框默认占位“想问什么？（回车＝解释这段）”，`Enter` 发送，`Shift+Enter` 换行，`Esc` 关闭。

### 3.2 模式 B：快问（不选文字）

两个入口，任选其一（建议都做）：

1. **输入框右侧按钮**：发送按钮左边一个 `✦ 快问` 图标按钮（`conversation.input.right` 槽）。
2. **全局快捷键**：`⌘/Ctrl+Shift+K`，在输入框上方浮出同一个卡片，但**不带引用**，输入框自动聚焦。

```
┌ 输入框 ─────────────────────────────────────────────┐
│  … 你的草稿 …                                       │
│  ＋  模型 ▾            [✦ 快问]  [发送]             │
└─────────────────────────────────────────────────────┘
                          │ 点击 / ⌘⇧K
               ┌──────────▼───────────────┐
               │ ✦ 快问              ✕    │
               │ [解释] [翻译] [总结] [举例]│
               │ ┌──────────────────────┐ │
               │ │ 直接问，不用开新会话  │ │
               │ └──────────────────────┘ │
               └──────────────────────────┘
```

要点：

- 快问**不读取、不发送**当前会话历史；它只是一个“随手问一下”的通道。
- 如果用户先在对话里选了文字再按快捷键，则自动变成模式 A（带引用）——两个模式共用一个入口时行为自然。
- `/ask 问题…` 斜杠命令作为第 3 个入口（可选，v1.1）：不提交消息，直接把问题带进快问卡。

### 3.3 同一张卡片的状态机

```
        ┌─────────┐  选中文字   ┌────────────┐
        │  idle   │────────────▶│ affordance │
        └─────────┘             └─────┬──────┘
             ▲                        │ 点击/快捷键
             │ Esc/点外部/关闭         ▼
        ┌────┴─────┐   发送     ┌────────────┐
        │  answer  │◀───────────│   input    │
        └────┬─────┘            └─────┬──────┘
             │ 追问                   │ 发送
             └───────────────────────▶│
                                      ▼
                               ┌────────────┐
                               │ streaming  │──▶ 完成 → answer
                               └─────┬──────┘
                                     └─ 停止/出错 → answer(error)
```

| 状态 | 卡片内容 | 可用操作 |
|---|---|---|
| idle | 不渲染 | — |
| affordance | 小胶囊“✦ 问这段” | 点击、Esc 隐藏 |
| input | 引用 + 预设 + 输入框 | 发送、切预设、关闭 |
| streaming | 引用（折叠）+ 流式答案 + 停止 + 常驻输入框 | 停止、关闭（丢弃） |
| answer | 答案 + 常驻输入框 + 动作栏 | 直接输入继续问、复制、插入输入框、发主会话、重试、关闭 |

> 追问不需要先点按钮：输入框在卡片底部常驻，回答结束后直接输入回车即可，宿主端沿用同一个隔离线程。

### 3.4 布局与几何规则

- **定位**：`position: fixed`，锚点取选区**最后一行**的 `Range.getBoundingClientRect()`。
- **翻转**：卡片高 > 下方可用空间且上方更宽裕时，翻到选区上方。
- **夹取**：左右夹在视口内 12px；最大高度 `min(45vh, 480px)`，超出滚动。
- **滚动**：在 input 状态，页面滚动即关闭（选区已经飘走）；在 streaming/answer 状态，卡片**钉住不动**直到用户关闭，避免答案读一半消失。
- **尺寸**：宽 `min(420px, 92vw)`；移动端退化为底部抽屉（v2）。
- **层级**：挂在 `shell.overlay`（框架级浮动层，天然点击穿透，条目自己开启 `pointer-events`）。

### 3.5 答案的呈现规则

- 第一行是**结论句**（模型被要求先给结论），后面最多 3 条解释。
- 支持 Markdown 子集：段落、有序/无序列表、行内代码、代码块、粗体、链接。
- 流式时逐字追加，右下角显示“停止”；完成后显示灰字元信息：`deepseek-flash · off · 1.2s`（可配置隐藏）。
- 代码块单行滚动，不做语法高亮的强依赖（v1 用等宽字体 + 背景；v2 可接 `MarkdownText`）。
- 不展示推理过程（本来就关掉了思考）；如果模型仍返回 reasoning chunk，直接丢弃。

### 3.6 键盘与无障碍

| 按键 | 行为 |
|---|---|
| `Enter` | 发送 / 追问 |
| `Shift+Enter` | 换行 |
| `Esc` | 依次：停止流式 → 收起卡片 → 隐藏恢复胶囊 |
| `⌘/Ctrl+Shift+E` | 有选区时打开划词问 |
| `⌘/Ctrl+Shift+K` | 打开快问 |
| `Tab` | 在预设 chip 与输入框间移动 |

- 卡片 `role="dialog"`、`aria-label="快问"`；打开时输入框自动聚焦，收起后焦点回到对话区。
- 答案容器 `aria-live="polite"`，流式过程中不打断读屏。
- 尊重 `prefers-reduced-motion`，动画降级为直接显示。
- 全部颜色走 `--dsw-alias-*` 变量，浅色/深色主题自动适配。

### 3.7 边界情况

| 情况 | 处理 |
|---|---|
| 选区在输入框 / 可编辑区域 | 不出现胶囊 |
| 选区跨多条消息 | 允许，按纯文本拼接（保留换行），上限 6000 字 |
| 选区过长 | 超过上限时截断并提示“仅发送前 6000 字” |
| 没有可用模型 | 卡片内显示“未配置模型”，给“打开模型设置”链接 |
| 连接断开 | 显示断线提示，答案保留，可重试 |
| 流式中关闭 | 弹确认“回答还没完成，关闭？”；确认后中止请求 |
| 连点发送 | 同一时刻只允许一个请求，新请求先中止旧的 |
| 空答案 | 显示“模型没有返回内容”，给重试 |
| 超时（默认 30s） | 中止并显示超时，可重试 |
| 页面刷新 | 全部丢弃（v1 明确不持久化） |

---

## 4. 架构

### 4.1 插件形态

一个 npm 包，host + client 各一半，沿用本机已验证的 `dsh-jj-panel` 极简构建方式（`tsc` + 一个 CJS 打包脚本，不引入 tsdown / CSS 管线）：

```
dsh-explainer/
├─ package.json          # dsh.bundle.patch + dsh.client
├─ cordis.patch.yml      # - insert: [{ id: explainer, name: "dsh-explainer" }]
├─ src/
│  ├─ host/
│  │  ├─ index.ts        # Cordis 插件入口（apply / inject）
│  │  ├─ service.ts      # 模型解析、快答引擎、并发与取消
│  │  ├─ routes.ts       # /explainer/config | /ask (SSE) | /cancel
│  │  └─ prompt.ts       # system prompt 与消息组装
│  └─ client/
│     ├─ meta.ts         # name / inject
│     ├─ store.ts        # 共享状态机（apply 闭包单例）
│     ├─ selection.ts    # 选区检测与锚点计算
│     ├─ overlay.tsx     # shell.overlay：胶囊 + 卡片
│     ├─ composer.tsx    # conversation.input.right：快问按钮 + 会话桥
│     ├─ markdown.tsx    # 轻量 Markdown 渲染（无 CSS 依赖）
│     └─ locales.ts      # zh / en
├─ locale/*.json         # 可选：走 DSH locale 机制
└─ lib/                  # 构建产物：host/index.js + client.js
```

`package.json` 关键字段：

```json
{
  "name": "dsh-explainer",
  "main": "./lib/host/index.js",
  "exports": {
    ".": { "default": "./lib/host/index.js" },
    "./client": { "default": "./lib/client.js" }
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["slots", "locale", "connection"] }
  }
}
```

### 4.2 Host 半

**注入**：`llm`、`webServer`、`connection` 必需；`agentDefaultModel`、`sessions` 可选（用 `ctx.get` 探测）。

**HTTP 路由**（全部用 `ctx.connection.requestRejection(req)` 做同源/信任围栏，与 `dsh-better-sidebar` 一致）：

| 路由 | 方法 | 作用 |
|---|---|---|
| `/explainer/config` | GET | 返回客户端需要的配置快照（可用模型、默认 effort、预设、上限） |
| `/explainer/ask` | POST | SSE 流式回答：`meta` → `delta*` → `done` / `error` |
| `/explainer/cancel` | POST | 按 `threadId` 中止在途请求 |

**请求体**：

```ts
interface AskRequest {
  threadId: string              // 客户端生成，用于取消/去重
  mode: 'selection' | 'quick'
  question: string              // 可为空，空则用默认“解释这段”
  selection?: string            // 模式 A 的选段
  context?: string              // 可选：选区所在消息的邻近文本（客户端截取）
  sessionId?: string            // 仅用于解析“当前会话用的模型”，不读历史
  provider?: string
  model?: string
  preset?: 'explain' | 'translate' | 'summary' | 'example'
}
```

**模型解析顺序**：

1. 请求里显式 `provider`/`model`（客户端可选传当前会话选择）；
2. 插件配置 `provider`/`model`；
3. 当前会话的模型选择（若 `sessionId` 可解析）；
4. `ctx.agentDefaultModel.currentSelection()`；
5. `ctx.llm.listProviders()[0]` + `listModels()` 的第一个。

**effort 选择**：`prepareCall(config, signal, (controls, model) => …)` 里读 `model.reasoning`：
- 配置显式指定 → 用配置；
- 否则取“最低可用档”：优先 `off`，其次 `minimal`，其次 `efforts[0]`；
- 模型不支持 reasoning → 不传。

**调用方式**（与 `session-title-llm` 这类一次性辅助调用完全一致）：

```ts
const call = await ctx.llm.prepareCall({ provider, model, maxTokens }, signal, (controls, model) => {
  const effort = pickLowestEffort(model)
  return { ...controls, ...(effort ? { reasoningEffort: effort } : {}) }
})
const options = { ...call.config, messages, system, signal }
for await (const chunk of call.stream(options)) {
  if (chunk.type === 'text-delta') push(chunk.text)   // → SSE delta
  if (chunk.type === 'finish') finish(chunk.reason)
}
```

- **不重试**：一次性直接调用没有自动重试；失败直接回 `error`，由用户点“重试”。
- **超时**：`AbortSignal.any([请求关闭信号, AbortSignal.timeout(timeoutMs)])`。
- **取消**：`res.on('close')` 会中止；`/cancel` 也按 `threadId` 中止。
- **限流**：每个 `threadId` 同时只允许一个在途请求；全局最多 4 个并发（超出返回 `busy`）。
- **日志**：只记录长度、耗时、finish kind；**绝不记录选段与答案正文**。

**消息组装**（`prompt.ts`）：

```
system:
你是 DSH 的“快问”解释器。用户会给你一段选中的文字和/或一个问题。
- 直接回答，不要寒暄、不要复述问题、不要“好的，我来解释”。
- 默认 3 句以内；需要列举时最多 3 条；先给结论，再给必要解释。
- 用用户提问的语言回答（中文问题用中文，英文问题用英文）。
- 只解释与问题相关的部分；不编造事实、文件路径或 API。
- 涉及代码时，给出最短的关键行或最小示例。
- 信息不足时，先用一句话说明缺什么，再给最可能的解释。

user:
[选中的文字]
<<<
{selection}
>>>

[附近上下文]（可选，客户端截取）
<<<
{context}
>>>

[问题]
{question || '解释这段'}
```

追问时保留 `system` + 首轮消息，再追加最近 3 轮 `user/assistant`（上限 6 条消息、总字符数 12000），保证“接着问”有上下文但不失控。

### 4.3 Client 半

**两个 slot 入口：**

1. `shell.overlay`（root 作用域，list，点击穿透）
   - id：`explainer.overlay`，order：`500`
   - 渲染“问这段”胶囊与快问卡片；通过 `useSessions` 找当前会话：
     `Object.values(state.byId).find(s => (s.retainedBy.mainView ?? 0) > 0)?.id`
2. `conversation.input.right`（session 作用域，list）
   - id：`explainer.quick-ask`，order：`250`
   - 渲染发送按钮左侧的 `✦ 快问` 按钮；
   - 同时作为“会话桥”：把自己的 `sessionId` 和 `inputActions` 写入共享 store，供 overlay 里的“插入输入框 / 发主会话”使用（组件卸载时清空）。

**共享状态**：在 `apply` 里创建 store（`createSnapshotStore` 或极简 `useSyncExternalStore` 兼容实现），通过 slot 注册的 `inject` face 传给两个组件；组件不碰 `ctx`。

**选区检测**（`selection.ts`）：

- 监听 `document` 的 `pointerup` 与 `selectionchange`（`selectionchange` 只在拖选结束后结算，避免抖动）。
- 排除：
  - 选区在 `input` / `textarea` / `[contenteditable]` 内；
  - 选区在 `[data-slot="conversation.composer"]` 内；
  - `window.getSelection()` 折叠或长度为 0。
- 命中范围：`selection.anchorNode.closest('[data-slot="main.conversation"]')` 非空（覆盖消息、推理、工具输出；不覆盖侧边栏与输入区）。
- 锚点：取 `range.getClientRects()` 最后一行 rect；清理空白、保留段落换行；超过 6000 字截断并标记。
- 鼠标按下、滚动（input 态）、窗口尺寸变化时重新结算或关闭。

**依赖复用**（都是允许运行时导入的静态共享包）：
- `@deepseek-ai/dsh-client-ui-primitives`：`useAnchoredPosition`、`useDismissOnOutsidePointer`、`MenuSurface`、`TextShimmer`、`ShortcutKeys`、`Toast`。
- 主题颜色一律 `var(--dsw-alias-…)`，与 `dsh-jj-panel` 相同做法。

**为什么不直接复用主会话**：
- 走主会话意味着一次完整 turn：系统提示、工具集、历史、可能的工具调用、写日志——首 token 慢、成本高、还会污染上下文。
- 快问是“旁路”：一条一次性 completion，天然满足“不深入思考、偏解释”的定位。
- “发给主会话”保留为显式升级动作。

### 4.4 数据流

```
用户划词
  └─ client selection.ts → store: affordance
       └─ 点击/⌘⇧E → store: input（引用 + 输入框）
            └─ 发送 → POST /explainer/ask
                 └─ host routes.ts → service.ask()
                      ├─ resolveModel / pickLowestEffort
                      ├─ ctx.llm.prepareCall + call.stream
                      └─ SSE: meta → delta* → done
                           └─ client 流式渲染 → answer
                                ├─ 复制
                                ├─ 插入输入框 → inputActions.insertText
                                ├─ 追问 → 追加消息再 /ask
                                └─ 发主会话 → inputActions.setDraft(引用+问题)
```

---

## 5. 快答策略（为什么这样才“快”）

| 决策 | 取值 | 理由 |
|---|---|---|
| 调用形态 | 一次性 completion | 无 agent loop、无工具协商、无历史重建 |
| 工具 | 无 | 快问不读文件、不执行，避免副作用与延迟 |
| reasoning effort | 最低可用（off / minimal） | 用户明确要“不深入思考” |
| 输出上限 | 800 tokens（可配） | 解释性答案不需要长文 |
| 温度 | 0.3（可配） | 稳定、少发挥 |
| 超时 | 30s（可配） | 超过就不值得等 |
| 重试 | 不自动，手点 | 避免吞掉错误与重复计费 |
| 上下文 | 选段 + 可选邻近文本 | 足够解释，又不把整段对话塞进去 |

---

## 6. 配置项

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `provider` / `model` | 空 | 留空则跟随当前会话/默认模型 |
| `reasoningEffort` | 空 | 留空取最低可用档 |
| `maxTokens` | `800` | 单次输出上限 |
| `temperature` | `0.3` | |
| `timeoutMs` | `30000` | |
| `selectionMaxChars` | `6000` | 选段上限 |
| `contextMaxChars` | `2000` | 邻近上下文上限 |
| `maxTurns` | `3` | 追问保留的轮数 |
| `presets` | `['解释','翻译','总结','举例']` | 预设按钮 |
| `shortcutSelection` | `Mod+Shift+E` | 划词问 |
| `shortcutQuick` | `Mod+Shift+K` | 快问 |
| `showMeta` | `true` | 显示模型/耗时 |
| `systemPrompt` | 空 | 高级：覆盖默认 system prompt |

配置通过 `cordis.patch.yml` 的 `config` 传入（DSH 的标准插件配置机制），客户端从 `/explainer/config` 读取展示所需的子集。

---

## 7. 安全与隐私

- 三个路由都过 `ctx.connection.requestRejection(req)`，与内置 `/api` 网关同一套同源/信任策略。
- 不写 Session 日志、不写任何磁盘缓存；选段与答案只存在于浏览器内存与这次 HTTP 流里。
- host 日志只记录元数据（字符数、耗时、finish 类型），不记录正文。
- 答案渲染禁止原始 HTML；Markdown 只走我们自己的 token → React 渲染，不 `innerHTML`。
- 关闭插件（`enabled: false` 或卸载 bundle）后，悬浮层与会话桥随 Cordis effect 一起销毁。

---

## 8. 性能与成本

- 首 token 目标：< 1.5s（取决于所选模型与网络）。
- 单次快问的输入通常 < 1k tokens、输出 < 800 tokens，成本远低于一次主会话 turn。
- 选区与上下文都在客户端裁剪，避免大段粘贴。
- 并发上限 4，单 thread 串行，防止误触时刷屏。

---

## 9. 里程碑

| 阶段 | 内容 | 验收 |
|---|---|---|
| M1 骨架 | 包结构、host 路由 + SSE、`shell.overlay` 空壳、构建与加载 | 页面能加载插件，`/explainer/config` 返回配置 |
| M2 划词问 | 选区检测、胶囊、卡片、流式答案、复制/关闭 | 选中文字能问到答案并流式显示 |
| M3 快问 + 追问 | composer 按钮、快捷键、追问、插入输入框、发主会话 | 两种模式都可用，追问有上下文 |
| M4 打磨 | 配置项、预设、错误态、a11y、主题、限流 | 边界情况全过，深浅主题一致 |
| M5 可选 | 轻量 Markdown 增强、右侧栏固定、`/ask` 命令、跨刷新恢复 | 按需 |

---

## 10. 待确认（需要你拍板）

1. **入口**：composer 里的 `✦ 快问` 按钮是否保留？还是只要快捷键 + 划词？
2. **快捷键**：`Mod+Shift+E` / `Mod+Shift+K` 是否符合你的习惯？
3. **模型**：快问默认“跟随当前会话模型”，还是固定一个更便宜的快模型？
4. **追问**：v1 要不要做多轮追问（会多留一点本地状态）？
5. **升级动作**：“发主会话”是插入到输入框（可编辑，不自动发），还是直接提交？
6. **安装方式**：按 `dsh-jj-panel` 的方式，在 profile 里用 `file:D:\explainer\dsh-explainer` 挂载并重启 DSH，可以吗？

---

## 附：与现有能力的对应关系

| 需要的能力 | DSH 现成机制 | 参考实现 |
|---|---|---|
| 插件加载（host+client） | `dsh.bundle.patch` + `dsh.client` + `window.__ModuleLoader__` | `dsh-jj-panel` |
| 框架级浮层 | `shell.overlay`（root，list，点击穿透） | 配额提示、Toast |
| 输入框旁按钮 | `conversation.input.right`（session，list） | 模型选择器 |
| 会话输入操作 | slot 标准 props `inputActions` | ui-conversation |
| 当前会话 | `useSessions(state => …retainedBy.mainView)` | `DocumentTitle` |
| 一次性模型调用 | `ctx.llm.prepareCall` + `call.stream` | `session-title-llm` |
| 流式 HTTP | `ctx.webServer.register` + SSE | `dsh-better-sidebar` |
| 定位/关闭/主题 | ui-primitives + `--dsw-alias-*` | `dsh-jj-panel` |
---

## 11. 实现记录（已交付）

### 11.0 第五轮迭代（better-sidebar 编辑器 + HTML 工具栏兜底）

- **better-sidebar 编辑器**：编辑器 tab 的 header 把文件路径写在 `input[title]` 上；选区检测在 `[data-dsh-pane]` / `[data-dsh-native-tab-host]` 容器里找这个 path，允许 CodeMirror 的 contenteditable 选区，并带上路径。原生 document preview（隐藏 marker）与 better-sidebar（path input）两条路径都覆盖。
- **HTML 预览的限制**：DSH 的 HTML 预览是 `sandbox="allow-scripts"` 的不透明 iframe，父页面无法读取其中选区。文档工具栏新增「✦ 问一下」：读取整个文件作为「当前文件」上下文，不需要选区。
- **发布**：0.2.1。

### 11.1 第四轮迭代（右侧栏文件 + 快和方便的定位）

- **右侧栏文件可用**：在原生 document preview 的工具栏注册一个隐藏 marker，携带当前文件的绝对路径；在预览正文里划词/右键时，选择检测会读取该 marker，并把文件路径随请求发送。宿主用 `readFileContext` 读取该文件全文（默认 20000 字，工作区内 realpath 校验）作为 `[当前文件]` 上下文；普通对话选择仍走路径/文件名提取的文件快照。
- **定位调整**：README、市场条目和 PR 都强调“快”和“方便”——一次 completion、右键/胶囊/快捷键、无子代理、不打断主会话。
- 卡片头部新增文件徽章（文件名，悬停显示完整路径）。

### 11.1 第三轮迭代（点外关闭 + 极简卡片 + 文件快照）

- **点外部关闭**：去掉所有收起/胶囊机制；点窗口外、按 Esc、再点一次「✦ 快问」都直接关闭。
- **右键快捷模式**：选中文字后右键直接打开问一下（捕获阶段拦截 contextmenu，仅当命中对话区有效选区时 preventDefault；配置 rightClick 可关闭）。
- **卡片极简**：删除引用下方的「N 字 / 展开」行、空态里的「继承对话上下文 · 只读快照」行、头部的继承徽章。引用仍可点击展开/收起。
- **off 可读化**：底部元信息把 adapter 的 effort id 映射为「不思考 / 低思考 / …」，不再直接显示 off。
- **文件快照**：宿主从选区/问题/继承对话中提取路径与文件名，在会话工作区内做 realpath 校验后读取修改时间、大小和前 4000 字，作为 `[文件快照]` 注入提示词；越界路径忽略。快问仍然是一次 completion，不挂工具。

### 11.1 第二轮迭代（模型一致 + 低负担收起）

- **模型与主窗口一致**：浏览器从 `useProjection('modelSelection')` 读取主窗口的持久模型选择，每次请求都带上 `provider/model`；宿主优先级改为 request → 主会话 request/header → 本线程 → 插件配置 → 部署默认。主窗口切换模型后，下一次快问/追问立即换过去；思考档位仍取最低。
- **低负担收起**：去掉右上角 ×。点窗口外面、按 `Esc`、或再点一次「✦ 快问」都会**收起**（不是销毁）；线程与流式答案保留，右下角出现「✦ 快问」胶囊，点它恢复；再按一次 `Esc` 才彻底收起。空卡片收起时直接消失，不留胶囊。
- 卡片头部新增当前模型徽章（与主窗口相同），鼠标悬停显示说明。

最终实现与设计稿的差异，以及落地细节。

### 11.1 交互定稿

- **追问零点击**：卡片底部输入框常驻；`streaming` 时按钮变「停止」，回答结束后直接输入回车就是追问，沿用同一个 `threadId`。
- **上下文继承 + 隔离**：每次「问这段」都新建 `threadId`；宿主在创建线程时读取主会话最近消息，做一次**只读快照**塞进首条消息，之后只往宿主内存里的线程追加，**主会话日志一个字节都不写**。
- **两种模式一张卡**：划词问带引用；快问不带引用，默认不继承上下文（可在卡片头部的徽章上切换，切换后新线程生效）。
- **窗口可拖动**：按住标题栏拖动；`Esc` 关闭；流式中点外部不会关闭，避免丢失答案。
- **答案动作**：复制 / 插入输入框 / 发主会话 / 重试（仅错误时）。

### 11.2 代码结构

```
dsh-explainer/
├─ package.json / cordis.patch.yml
├─ src/host/
│  ├─ index.ts        # Cordis 入口，注册 /explainer/config 与 /explainer/ask
│  ├─ routes.ts       # 信任围栏、SSE、请求解析与错误映射
│  ├─ engine.ts       # 模型解析、最低 effort、线程、并发、取消
│  ├─ prompt.ts       # system prompt 与首轮/追问消息组装
│  ├─ transcript.ts   # 主会话只读快照（事件 → 文本、模型路由）
│  ├─ threads.ts      # 有界 LRU + TTL 的线程表
│  ├─ config.ts       # 配置归一化与公开子集
│  └─ types.ts        # 结构化服务接口（不依赖 @deepseek-ai 运行时）
├─ src/client/
│  ├─ index.ts        # apply：样式、locale、两个 slot 注册
│  ├─ overlay.tsx     # shell.overlay：选区胶囊 + 窗口 + toast
│  ├─ composer.tsx    # conversation.input.right：快问按钮 + 会话桥
│  ├─ store.ts        # 状态机、SSE 解析、rAF 批量更新、取消
│  ├─ selection.ts    # 选区检测、范围判定、几何
│  ├─ markdown.tsx    # token → React 的安全 Markdown 子集
│  ├─ styles.ts       # 注入式样式表（随 fiber 卸载）
│  └─ locales.ts      # zh/en
├─ test/              # 单元 + 路由集成 + bundle 冒烟 + jsdom UI
└─ e2e/               # 真实 Chrome CDP 端到端脚本
```

### 11.3 关键实现决策

| 问题 | 决策 |
|---|---|
| 宿主依赖 | 不 import `@deepseek-ai/*`；用结构化接口 `ctx.get('llm'/'sessions'/'webServer')`，跨小版本更稳 |
| 客户端依赖 | 运行时只依赖 harness 注入的 `react`；构建脚本拒绝任何其他裸 require |
| 流式 | `POST /explainer/ask` 返回 SSE；客户端 `fetch` + `ReadableStream` 解析，rAF 合并 UI 更新 |
| 信任 | 三个路由都过 `ctx.connection.requestRejection(req)`，无连接服务时 fail closed |
| 取消 | 浏览器 abort → 服务器 `res.on('close')` → 取消模型流；30s 超时映射为 `timeout` |
| 并发 | 进入 `run` 立即占位，全局 4 并发，超限回 `busy` 而不是排队 |
| 消息隔离 | 传给模型的是线程消息的**副本**；线程只在答案完成后追加 |
| 隐私 | 日志只记元数据；选段与答案不落盘；答案不进 Session |
| 性能 | `useSyncExternalStore` + 切片订阅；流式 60fps 合并；`React.memo` 渲染逐轮；卡片最大高度约束不触发滚动重排 |

### 11.4 验证

```sh
cd D:\explainer\dsh-explainer
npm run build      # tsc host/client + 单文件 CJS bundle
node --test test/*.test.mjs
```

覆盖：

- 配置归一化与边界夹取；
- 会话快照（只读、预算内、模型路由提取）；
- 线程 LRU/TTL；
- 引擎：首轮继承一次、追问不重读、effort=off、并发拒绝、会话日志不变；
- 模型优先级：request → 主会话 request/header → 本线程上次 → 插件配置；
- 路由：配置 200、SSE 帧顺序、围栏 403、坏请求 400；
- 客户端 bundle：加载、注册两个 seat、样式注入、卸载清理；
- jsdom UI：打开、流式、追问同线程、插入输入框、主窗口模型随请求发送、点外部收起并恢复；
- **真实 Chrome E2E**：启动一个复用 web profile 的临时实例（fake 适配器），验证启动页、`/explainer/config`、SSE 流、选区胶囊、划词引用、追问、点窗口外收起 + 胶囊恢复、两级 `Esc`。

### 11.5 安装

```text
1. 包已在 D:\explainer\dsh-explainer，并已构建 lib/。
2. desktop profile 的 package.json 已添加：
   "dsh-explainer": "file:D:\\explainer\\dsh-explainer"
   且 dsh.profile.bundles 已追加 "dsh-explainer"。
3. profile 的 node_modules 已建 junction：
   node_modules\dsh-explainer -> D:\explainer\dsh-explainer
4. 重启 DSH 桌面应用后生效（host 半需要重启；client 半随页面加载）。
```

### 11.6 已知限制

- 不做多选、图片输入、跨消息多段引用。
- 线程只在宿主内存里，刷新页面/重启即丢（产品定位就是“随手问”）。
- 上下文快照只取最近 8 条消息、8000 字；更早的历史不在快问里。
- 快问不挂工具、不读文件；需要深入时用「发主会话」升级。