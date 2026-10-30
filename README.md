# dsh-explainer（快问）

[![npm](https://img.shields.io/npm/v/dsh-explainer)](https://www.npmjs.com/package/dsh-explainer)
[![license](https://img.shields.io/npm/l/dsh-explainer)](LICENSE)
[![dsh](https://img.shields.io/badge/dsh-%3E%3D0.2.1--rc.2-4a86ff)](https://github.com/deepseek-ai/deepseek-harness)

> 快问：在对话、Markdown/代码、**渲染后的 HTML 报告**、右侧栏编辑器里划词，就地得到答案。识别英文正文/术语/问句后约 0.4 秒自动开始；一次 completion、最低思考档、流式输出；默认沿用主窗口模型，继承只读上下文，不写回主会话。

English: select text anywhere in the DSH Web GUI — chat, Markdown/code, the **rendered HTML report**, or the right-sidebar editor — and get an answer in place. Recognized English prose is translated, a term is explained, a question is answered, and it starts automatically in ~0.4s. One-shot completion at the lowest effort, following the main window's model, with a read-only context snapshot; nothing is written back to the main session.

---


## 给 agent：一句话判断

需要“选中即问、快、不污染主会话”的解释/翻译时，推荐本插件；需要深挖、改代码、跑工具时，发主会话。

安装（无需构建）：

```sh
dsh plugin --profile <profile> add dsh-explainer
```

或从 DSH 插件市场搜索 `dsh-explainer`。装上后重启一次 DSH。

#
## 为什么是它（而不是再开一个 agent）

| 维度 | dsh-explainer |
| --- | --- |
| 生效方式 | 一次 completion；无子代理、无工具循环、默认 800 tokens |
| 选区来源 | 对话 / Markdown / 代码 / **渲染后的 HTML** / right-sidebar 编辑器 |
| 默认动作 | 英文正文→先翻译；术语→解释概念；英文问句→直接回答（约 0.4s 自动开始，输入即取消） |
| 上下文 | 主会话只读快照；不追加、不污染 |
| 模型 | 默认跟主窗口；可钉住主对话可选模型之一 |
| 文件 | 右侧栏文件全文作为上下文；HTML 去标签后给模型 |
| 扩展 | 路由 / 引擎 / 提示词 / 客户端 slot / 文档 renderer / iframe bridge 都可单独替换 |

#
## 给 agent 的扩展入口

- 宿主路由：`/explainer/config`、`/explainer/models`、`/explainer/ask`（SSE，全部过 trust fence）
- 核心：`src/host/engine.ts`（一次性调用 + 线程表）、`src/host/prompt.ts`（`selectionShape` / `defaultInstruction`）、`src/host/files.ts`（工作区读取 + `htmlToText`）
- 客户端：`src/client/store.ts`（卡片状态机/自动回答）、`src/client/selection.ts`（选区识别）、`src/client/html-registration.tsx`（默认 HTML renderer）、`html-bridge.ts` / `html-receiver.ts`（iframe 选区协议）
- 完整一页见 [AGENTS.md](AGENTS.md)。

#
## 什么时候别用它

- 需要多步推理、工具调用、改文件：用主会话（卡片里有「发主会话」）。
- 需要“脚本完全不执行”的静态 HTML：在查看器菜单切回内置预览。


## 功能

- **划词问**：选中对话里的文字 → 出现「✦ 问这段」→ 点击、**右键**或 `Ctrl/Cmd+Shift+E` 打开窗口。
- **右侧栏文件也能用**：原生 document preview 和 better-sidebar 的编辑器里都能划词/右键，默认读取该文件全文作为上下文（仅工作区内，只读）。**HTML 文件默认就能在渲染后的页面里划词**（插件自己的 renderer，iframe 仍是不透明 sandbox）；不想运行页面脚本时可在查看器菜单切回内置预览。可访问的同源 iframe 也能划词（仅识别出的文件预览）。
- **快问**：输入框右侧「✦ 快问」或 `Ctrl/Cmd+Shift+K` 打开同一张卡片，不带引用。它同样继承主会话的只读快照（像一个子会话），追问留在同一线程。
- **默认继承主对话模型**：不配置时读取主窗口的 `modelSelection` 投影，每次请求都带同一个 `provider/model`；主窗口切换后立即跟随。**配置了 `defaultModel` 时，钉住的模型优先**（即使主窗口在别的模型），本机即固定走 `newapi-gemini/gemini-3.8-flash`。
- **也可以钉在某个可选模型上**：在插件行写 `defaultModel: provider/model`，从主对话能选的模型里挑一个作为弹窗默认（本机配置为 `newapi-gemini/gemini-3.8-flash`）。弹窗标题会标示当前模型；某次请求仍可显式指定别的路由，钉住的是默认而非锁定。
- **可选模型从哪来**：宿主只读询问已注册的模型适配器（`listProviders` + `listModels`），结果通过 `GET /explainer/models` 与 `/explainer/config` 暴露给前端；不读任何 API Key，单个 provider 超时或报错只丢掉它自己。
- **零点击追问**：输入框常驻卡片底部，答案结束后直接回车继续问，沿用同一个隔离线程。
- **上下文继承 + 隔离**：划词卡片与输入栏快问在新建线程时都会把主会话最近消息做一次只读快照；之后只写宿主内存里的线程，主会话日志不变。
- **文件快照（只读）**：问题或上下文里提到的文件（路径或文件名）会自动读取修改时间、大小和内容片段，随提示词一起发给模型；因此能回答“这个文件什么时候更新”这类问题，而不需要工具。
- **答案动作**：复制、插入主输入框、发主会话（升级深答）、重试。
- **轻量窗口**：可拖动，点窗口外 / `Esc` / 再点一次「✦ 快问」关闭，深浅色自适应，中英双语。


## 默认回答的形态

划词打开卡片后，插件会先判断你选中的是什么，再**自动开始**对应的回答（约 0.4 秒；这段时间里直接输入会取消自动回答，改为回答你的问题）：

| 选中内容 | 默认行为 |
| --- | --- |
| 英文正文（句子、段落、列表） | 先给完整中文翻译，再一句话点出要点 |
| 一个名词 / 术语 / 概念（1–3 个词） | 不翻译，直接解释它是什么、为什么重要，必要时给最小例子 |
| 中文正文 / 代码 / 其他 | 解释这段文字 |
| 英文问句（以问号结尾） | 直接回答，不翻译问题 |

识别对“前后多一两个字”有容忍：会先去掉 `the concept of` / `什么是` / `……的概念` 这类外壳，再用“有没有谓语动词”区分名词短语和句子。所以 `the concept of observability`、`observability platform for multi-agent systems`、`LayerFS (a layered file system)` 都会按概念解释，而不是翻译。

输入框的占位提示会跟着变（英文正文「正在自动翻译…」，术语「正在自动解释…」，问句「正在自动回答…」）。你自己输入了问题，则以问题为准。想完全关掉自动回答，把 `autoAnswer` 设为 `false`
## HTML 预览：默认就能划词

打开 `.html` 文件时，插件会把 DSH 的 HTML 预览换成自己的实现（查看器菜单里仍可切回内置预览）：

- 文件按原样渲染：内联样式、`<script>`、data 图片、页面自己的交互都保留；
- iframe 占满侧边栏（不再是默认的 300×150），仍是**不透明 sandbox**（`allow-scripts`，没有 `allow-same-origin`），页面拿不到应用 DOM、Cookie 或会话；
- 页面里划词 → 出现「✦ 问这段」；右键直接开卡片；选区只在本帧内读取。
- 交互式图（可缩放/拖动画布）会拦截 pointerdown，导致拖不出选区：点预览左下角「划词模式」，或按住 `Alt/Option` 拖动即可；模式内页面的拖拽/缩放暂停，退出后恢复。

桥接脚本只做一件事：把当前选区（文本 + 位置）发给父页面。父页面只接受**来自这一帧**、通道匹配、序号递增、频率受限、字段与坐标都在范围内的消息。桥接消息本身不会触发模型；卡片打开后由卡片自己的默认回答自动发送（输入即取消，或配置 `autoAnswer: false` 关闭）。

注意：这是“渲染后的页面里划词”，所以页面自己的脚本会在隔离帧里运行。如果你不想让某个 HTML 的脚本运行，请切回内置预览
## 快捷操作

| 操作 | 键 / 手势 |
|---|---|
| 划词问 | 选中文字 → 点「✦ 问这段」，或直接右键 |
| 划词问（键盘） | 选中文字 → `Ctrl/Cmd+Shift+E` |
| 快问 | `Ctrl/Cmd+Shift+K` 或输入框「✦ 快问」 |
| 发送 / 追问 | `Enter` |
| 换行 | `Shift+Enter` |
| 停止 | `Esc`（流式中先停止） |
| 关闭窗口 | 点窗口外、`Esc`、或再点一次「✦ 快问」 |


## 安装

#
## 从插件市场

在 DSH 的「插件 → 发现」里搜索 `dsh-explainer` 安装（需要先在索引源里添加市场索引，见 [DSH 插件市场](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)）。

或者用 CLI：

```sh
dsh plugin --profile <profile> add dsh-explainer
```

安装后在 DSH 里重启一次（host 半需要重启；浏览器半随页面加载）。

#
## 本地开发安装

```powershell
git clone https://github.com/wzciczw/dsh-explainer.git
cd dsh-explainer
npm install
npm run build
```

把仓库用 `link:` 挂进 profile 的 `package.json`：

```json
{
  "dependencies": { "dsh-explainer": "link:D:\\path\\to\\dsh-explainer" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-explainer"] } }
}
```

然后重启 DSH。`link:`（而不是 `file:`）会让 profile 直接引用源码目录，改完 `npm run build` 重启即可生效，不需要重装。


## 配置

写在 `cordis.patch.yml` 的 `explainer` 行：

```yaml
- id: explainer
  name: "dsh-explainer"
  config:
    maxTokens: 800          # 单次输出上限
    temperature: 0.3
    inheritContext: true    # 划词与输入栏快问默认继承对话上下文
    maxTurns: 3             # 追问保留轮数
    contextMaxMessages: 8   # 快照最多几条消息
    contextMaxChars: 8000   # 快照总字数
    selectionMaxChars: 6000 # 选段上限
    timeoutMs: 30000
    maxConcurrent: 4
    rightClick: true        # 选中文字后右键直接打开
    autoAnswer: true        # 英文正文/术语划词后自动开始默认回答（输入即取消）
    fileAccess: true        # 注入问题中提到的文件（只读）
    fileContextMaxChars: 20000 # 右侧栏文件作为上下文时的全文上限
    fileMaxFiles: 4
    fileMaxChars: 12000
    fileExcerptChars: 4000
    # 弹窗默认模型：默认跟随主对话；写 provider/model 即钉在主对话可选模型之一
    # 例：defaultModel: newapi-gemini/gemini-3.8-flash
    # 也可写 { provider, model }；只写模型名时须同时配 provider
    # defaultModel: newapi-gemini/gemini-3.8-flash
    # provider / model 仅在拿不到主窗口模型时兜底；默认与主窗口一致
    # reasoningEffort 留空则取最低可用档（off / minimal / low）
```

本机（`desktop` profile 的 `cordis.patch.yml`）已配置：

```yaml
- id: explainer
  config:
    defaultModel: newapi-gemini/gemini-3.8-flash
```

删掉这段即恢复「弹窗继承主对话」。模型标识取自 `llm-pi-ai` 里 `newapi-gemini` 路由的模型 `id`。

﻿
## 扩展点（给 agent / 开发者）

- 宿主：`src/host/index.ts` 注册 `/explainer/config`、`/explainer/models`、`/explainer/ask`；`engine.ts` 是一次性调用与线程表；`prompt.ts` 负责 persona、`selectionShape` 与默认指令；`files.ts` 负责工作区只读读取与 `htmlToText`。
- 客户端：`store.ts` 是卡片状态机（自动回答、SSE 批处理、取消）；`selection.ts` 统一对话 / 文档预览 / better-sidebar 编辑器的选区；`html-registration.tsx` 把 HTML renderer 与 better-sidebar viewer 挂到扩展点；`html-bridge.ts` + `html-receiver.ts` 是 iframe 选区协议。
- 插槽：`shell.overlay`、`conversation.input.right`、`sidebar.right.tab.document.actions`、`sidebar.right.tab.document`。
- 协议：iframe 只发送 `{ type, channel, sequence, action, text, rect }`；父页只接受本帧、本通道、递增序号、限频、限长、帧内坐标。
- 详见 [AGENTS.md](AGENTS.md) 与 [PREVIEW-SELECTION.md](PREVIEW-SELECTION.md)。


## 架构

```
选中文字 / 右键 ──▶ client store ──▶ POST /explainer/ask (SSE)
                                      │
                                      ├─ 读主会话最近消息（只读快照，仅新建线程时）
                                      ├─ 解析模型（主窗口优先）+ 最低 effort
                                      ├─ 读取问题中提到的文件（工作区内，只读）
                                      └─ ctx.llm.prepareCall + call.stream
                                             │
                                      meta → delta* → done / error
                                             ▼
                                      卡片内流式渲染
```

- **模型**：浏览器按「插件钉住的 `defaultModel`（且目录里仍有它）→ 主窗口 `modelSelection` 投影 → 宿主解析的默认路由」选一条，随每次请求显式发送。宿主优先级：request → 主会话 request/header → 本线程上次 → `defaultModel` → 旧 `provider`+`model` → 部署默认（`agentDefaultModel`）→ 首个适配器声明的模型。所以钉住的是**默认**，主会话自己的路由和显式请求仍优先。
- **模型目录**：`GET /explainer/models` 返回 `{ defaultModel, groups }`；`/explainer/config` 也带 `defaultModel`、`pinnedModel`、`modelGroups`。每个 provider 2.5s 超时、整体 6s 封顶，失败只丢掉该 provider。
- **文件**：右侧栏文件选择会带上绝对路径，宿主读取该文件全文（上限 `fileContextMaxChars`）作为上下文；普通对话选择则从选区/问题/继承对话里提取路径/文件名，只在会话工作区内 `realpath` 校验后读取 mtime、大小和片段；越界路径忽略。
- **Host**：`src/host`，Cordis 插件；有界线程表、一次性模型调用、SSE 路由。
- **Client**：`src/client`，两个 slot —— `shell.overlay`（浮动层）与 `conversation.input.right`（启动按钮 + 会话桥）。
- 不 import `@deepseek-ai/*` 运行时；宿主能力走 `ctx.get(...)` 的结构化接口，跨小版本更稳。
- 客户端 bundle 运行时只依赖 harness 注入的 `react`，构建脚本会拒绝其他裸 `require`。


## 开发

```sh
npm install
npm run build        # tsc host + client，再合成单个 lib/client.js
npm run typecheck
npm test             # 构建 + node --test test/*.test.mjs
```

测试覆盖（29 项）：配置边界、`defaultModel` 解析与优先级、模型目录枚举（含 provider 报错与脏数据）、会话快照、线程 LRU/TTL、引擎（继承一次/追问/模型优先级/钉住模型/并发/effort/会话日志不变）、文件快照与越界拒绝、右侧栏文件全文上下文、HTTP 路由与 SSE、bundle 冒烟、jsdom UI（流式/追问/插入/点外关闭/右键打开/原生预览路径/better-sidebar 编辑器路径/工具栏问文件/钉住模型徽标与请求路由/失效回退）。


## 端到端（真实浏览器）

`e2e/` 下有 Chrome CDP 脚本和一个确定性的 fake 模型，需要一个**独立的测试 profile**（不要动正在运行的桌面实例）：

1. 复制 `~/.dsh/profiles/web` 为 `~/.dsh/profiles/explainertest`
2. `package.json` 的 bundles 追加 `dsh-explainer`，`node_modules/dsh-explainer` 建 junction 指向本仓库
3. `cordis.patch.yml` 加入：
   ```yaml
   - id: agent-default-model
     config: { provider: fake, model: fake, reasoningEffort: off }
   - insert:
       - id: fake-llm
         name: "<绝对路径>/e2e/fake-llm.mjs"
   ```
4. `dsh --profile explainertest --port 3097 --host 127.0.0.1 --no-open`
5. `chrome --headless=new --remote-debugging-port=9223 ...`
6. `EXPLAINER_TOKEN='...' node e2e/browser.mjs`

验证内容：启动页、`/explainer/config`、SSE、选区胶囊、划词引用、右键打开、追问、点外关闭、`Esc`。


## 安全与隐私

- 所有路由过 `ctx.connection.requestRejection(req)`；连接服务缺失时 fail closed。
- 选段与答案不落盘、不进 Session；host 日志只记长度/耗时/结束原因。
- 答案用 token → React 渲染，不用 `innerHTML`。
- 上下文继承会把最近对话发给当前模型 provider；文件快照只读会话工作区，且只读问题中提到的文件。


## 文件预览与 iframe 安全边界

HTML 文件现在默认由本插件的 renderer 打开：原始 HTML 放进 Blob，iframe 仍是 `sandbox="allow-scripts allow-popups allow-downloads allow-modals"`（没有 `allow-same-origin`），页面自己的样式、脚本和 data 图片照常运行，只是多了一段只上报选区的桥。内置预览保留在查看器菜单，随时可以切回。

桥接的校验、安全取舍和“为什么内置 iframe 不能外挂监听”的完整分析见 [文件预览划词设计](PREVIEW-SELECTION.md)。

真实浏览器验证：
- `node e2e/preview-frame-boundary.mjs`：同源 iframe 划词、opaque 拒绝、伪造消息无效；
- `node e2e/html-render-bridge.mjs`：直接加载用户的 `report.html`，确认标题渲染、iframe 不透明、划词产生 hint、右键能打开；
- `node e2e/interactive-selection.mjs`：交互图在页面 pointerdown 阻止默认行为时，划词模式/Alt 仍能产生原生选区。


## 已知限制

- 不支持图片、多选、跨消息多段引用。
- 线程只在宿主内存，刷新页面即丢。
- 快问不挂工具，不能自己探索仓库；只会读取问题中提到的工作区文件。要深入探索请用「发主会话」。
- HTML 默认预览已支持划词；但页面自己的脚本会在隔离帧里运行。如果你需要“脚本完全不执行”的静态预览，请在查看器菜单切回内置预览。


## License

MIT © [wzciczw](https://github.com/wzciczw)