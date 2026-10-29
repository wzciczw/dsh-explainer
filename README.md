# dsh-explainer（快问）

[![npm](https://img.shields.io/npm/v/dsh-explainer)](https://www.npmjs.com/package/dsh-explainer)
[![license](https://img.shields.io/npm/l/dsh-explainer)](LICENSE)
[![dsh](https://img.shields.io/badge/dsh-%3E%3D0.2.1--rc.2-4a86ff)](https://github.com/deepseek-ai/deepseek-harness)

> 在 DSH 对话里选中文字就地提问；不选文字时也能开一个独立的快问窗口。
> 一次 completion、最低思考档、流式回答；沿用主窗口的模型，继承只读上下文，不写回主会话。

English: select text in the DSH Web GUI and ask about it in place, or open a quick-ask window. Answers stream from a one-shot completion that follows the main window's model, inherits a read-only context snapshot, and reads files the question references. Nothing is written back to the main session.

---

## 功能

- **划词问**：选中对话里的文字 → 出现「✦ 问这段」→ 点击、**右键**或 `Ctrl/Cmd+Shift+E` 打开窗口。
- **快问**：输入框右侧「✦ 快问」或 `Ctrl/Cmd+Shift+K` 打开同一张卡片，不带引用。
- **模型与主窗口一致**：读取主窗口的 `modelSelection` 投影，每次请求都带同一个 `provider/model`；主窗口切换后立即跟随。
- **零点击追问**：输入框常驻卡片底部，答案结束后直接回车继续问，沿用同一个隔离线程。
- **上下文继承 + 隔离**：新建线程时把主会话最近消息做一次只读快照；之后只写宿主内存里的线程，主会话日志不变。
- **文件快照（只读）**：问题或上下文里提到的文件（路径或文件名）会自动读取修改时间、大小和内容片段，随提示词一起发给模型；因此能回答“这个文件什么时候更新”这类问题，而不需要工具。
- **答案动作**：复制、插入主输入框、发主会话（升级深答）、重试。
- **轻量窗口**：可拖动，点窗口外 / `Esc` / 再点一次「✦ 快问」关闭，深浅色自适应，中英双语。

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

### 从插件市场

在 DSH 的「插件 → 发现」里搜索 `dsh-explainer` 安装（需要先在索引源里添加市场索引，见 [DSH 插件市场](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)）。

或者用 CLI：

```sh
dsh plugin --profile <profile> add dsh-explainer
```

安装后在 DSH 里重启一次（host 半需要重启；浏览器半随页面加载）。

### 本地开发安装

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
    inheritContext: true    # 划词问默认继承对话上下文
    maxTurns: 3             # 追问保留轮数
    contextMaxMessages: 8   # 快照最多几条消息
    contextMaxChars: 8000   # 快照总字数
    selectionMaxChars: 6000 # 选段上限
    timeoutMs: 30000
    maxConcurrent: 4
    rightClick: true        # 选中文字后右键直接打开
    fileAccess: true        # 注入问题中提到的文件（只读）
    fileMaxFiles: 4
    fileMaxChars: 12000
    fileExcerptChars: 4000
    # provider / model 仅在拿不到主窗口模型时兜底；默认与主窗口一致
    # reasoningEffort 留空则取最低可用档（off / minimal / low）
```

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

- **模型**：浏览器从 `useProjection('modelSelection')` 读主窗口的持久选择，随每次请求发送；宿主优先级 request → 主会话 request/header → 本线程上次 → 插件配置 → 部署默认。
- **文件**：宿主从选区、问题、继承的对话里提取路径/文件名，只在会话工作区内 `realpath` 校验后读取 mtime、大小和前 4000 字；越界路径忽略。
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

测试覆盖（16 项）：配置边界、会话快照、线程 LRU/TTL、引擎（继承一次/追问/模型优先级/并发/effort/会话日志不变）、文件快照与越界拒绝、HTTP 路由与 SSE、bundle 冒烟、jsdom UI（流式/追问/插入/点外关闭/右键打开）。

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

## 已知限制

- 不支持图片、多选、跨消息多段引用。
- 线程只在宿主内存，刷新页面即丢。
- 快问不挂工具，不能自己探索仓库；只会读取问题中提到的工作区文件。要深入探索请用「发主会话」。

## License

MIT © [wzciczw](https://github.com/wzciczw)