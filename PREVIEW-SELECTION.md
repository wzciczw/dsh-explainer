# 文件预览划词：现在的实现与边界

## 结论

打开 `.html` 文件时，插件**默认**用自己的 renderer，不需要从菜单里另选：

- 原始 HTML 原样放进 Blob，iframe 是 `sandbox="allow-scripts allow-popups allow-downloads allow-modals"`，**没有** `allow-same-origin`；
- 页面自己的内联样式、`<script>`、data 图片、交互照常运行；只在 `</body>` 前追加一段只负责上报选区的脚本；
- 在渲染后的页面里划词 → 「✦ 问这段」；右键直接开卡片；`Esc`/点外关闭；
- 内置 HTML 预览仍保留在查看器菜单，可随时切回（想要“脚本完全不执行”的静态预览时用它）。

## 为什么不能直接监听内置 iframe

内置 HTML 预览运行在不透明 sandbox iframe 中（交互模式 `sandbox="allow-scripts"`，静态模式 `sandbox=""` + CSP）。浏览器禁止父页面读取它的 DOM/`getSelection()`，子文档事件也不冒泡到父文档；`postMessage` 又需要子文档里先有 owner 安装的代码。**在不改 core、不注入内置 iframe 的前提下，父页面无法拿到其中的选区。**

插件没有去改写内置 iframe、放宽 sandbox 或截获它的资源；而是注册了一个**自己拥有的** HTML renderer（`documentPreviews.register` + keyed `sidebar.right.tab.document`，`priority: 'extension'`），以及 better-sidebar 的 `registerFileViewer`（优先级高于内置 `html`）。

## 桥的消息校验

父页面（`html-receiver.ts`）只接受：

- `event.source === 该 iframe.contentWindow`；
- `type` 与每次挂载新生成的 `channel` 匹配；
- `sequence` 严格递增，1 秒最多 40 条；
- 文本 2–6000 字；坐标都是有限数、右/下大于左/上、且落在该帧视口内；
- 坐标按 iframe 边框与缩放换算到父页面。

收到消息只做两件事：显示「问这段」、或（右键/快捷键）打开卡片。**不会**自动发起模型请求；文件路径由父页面决定，页面自报的路径不会被采信；卸载时解绑全部监听。

## 取舍

页面脚本在隔离帧里运行，等价于内置的“交互式 HTML 预览”加一条选区通道。恶意页面理论上可以伪造选区文本，但它拿不到父页面、Cookie、会话或文件系统，最多让你看到一段错误的引用；发送仍由你确认。需要脚本完全不执行时，切回内置预览。

## 验证

- `npm test`：66 项，覆盖桥的字段/频率/来源校验、生成文档、注册优先级、选区形状、文件上下文等。
- `node e2e/preview-frame-boundary.mjs`：同源 iframe 划词、opaque 拒绝、伪造消息无效。
- `node e2e/html-render-bridge.mjs`：直接加载用户的 `report.html`，确认标题渲染、iframe 不透明、划词产生 hint、右键能打开。
