window.__ModuleLoader__.load({ id: "dsh-explainer", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defs = Object.create(null);
var __cache = Object.create(null);
function __require(id) {
  if (id.startsWith("./")) {
    var key = id.slice(2).replace(/.js$/, "");
    return __load(key);
  }
  return require(id);
}
function __load(id) {
  if (id in __cache) return __cache[id];
  if (!(id in __defs)) throw new Error('module not bundled: ' + id);
  var module = { exports: {} };
  __cache[id] = module.exports;
  __defs[id](module, module.exports, __require);
  __cache[id] = module.exports;
  return __cache[id];
}
__defs["composer"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposerButton = ComposerButton;
const React = __importStar(require("react"));
const selection_1 = require("./selection");
const use_store_1 = require("./use-store");
/**
 * The composer entry does two jobs: it is the discoverable 快问 launcher, and
 * it publishes the current session's composer actions so the floating window
 * can insert text or hand a question back to the main conversation.
 */
function ComposerButton(props) {
    const { store, t, sessionId, inputActions } = props;
    const buttonRef = React.useRef(null);
    const enabled = (0, use_store_1.useStore)(store, snapshot => snapshot.config?.enabled !== false);
    const draft = props.useInput(state => state.draft);
    const draftRef = React.useRef(draft);
    draftRef.current = draft;
    // Mirror the main window's durable model selection: the ask window must use
    // the exact same provider/model, and follow a switch made in the main UI.
    const selection = props.useProjection('modelSelection', value => value?.next);
    const selectedProvider = selection?.provider;
    const selectedModel = selection?.model;
    React.useEffect(() => {
        store.setSessionModel(typeof selectedProvider === 'string' && typeof selectedModel === 'string'
            ? { provider: selectedProvider, model: selectedModel }
            : null);
    }, [store, selectedProvider, selectedModel]);
    React.useEffect(() => {
        store.setBridge({
            sessionId,
            getDraft: () => draftRef.current,
            insertText: text => {
                try {
                    return inputActions.insertText(text, inputActions.captureInsertion());
                }
                catch {
                    return false;
                }
            },
            setDraft: text => inputActions.setDraft(text),
        });
        return () => { store.setBridge(null); };
    }, [store, sessionId, inputActions]);
    const open = (event) => {
        event.preventDefault();
        // The launcher doubles as the window toggle: open, or close when already open.
        if (store.getSnapshot().card !== null) {
            store.close();
            return;
        }
        const anchor = (0, selection_1.findComposerRect)() ?? buttonRef.current?.getBoundingClientRect();
        if (anchor === undefined)
            return;
        store.openQuick({
            left: anchor.left,
            top: anchor.top,
            right: anchor.right,
            bottom: anchor.bottom,
            width: anchor.width,
            height: anchor.height,
        });
    };
    if (!enabled)
        return null;
    return (React.createElement("button", { ref: buttonRef, type: "button", className: "dx-launcher", title: `${t('quickAsk')} (Ctrl+Shift+K)`, "aria-label": t('quickAsk'), onClick: open },
        React.createElement("span", { className: "dx-spark" }, "\u2726"),
        t('quickAsk')));
}

};
__defs["file-marker"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMarker = FileMarker;
const React = __importStar(require("react"));
/**
 * The document preview's toolbar contribution.
 *
 * It publishes the previewed file's absolute path as a hidden marker (the
 * selection detector reads it back from the preview root), and offers an
 * explicit "Ask" action. The action matters for HTML previews: they render in
 * an opaque sandboxed iframe whose selection the parent page cannot read, so
 * the toolbar is the only way in there — the host still reads the whole file.
 */
function FileMarker(props) {
    const { store, t, absolutePath } = props;
    if (typeof absolutePath !== 'string' || absolutePath.trim() === '')
        return null;
    return (React.createElement(React.Fragment, null,
        React.createElement("span", { hidden: true, "data-explainer-file-path": absolutePath }),
        React.createElement("button", { type: "button", className: "dx-file-ask", title: t('askFile'), onClick: (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                store.openSelection(rect, '', absolutePath);
            } },
            React.createElement("span", { "aria-hidden": "true" }, "\u2726"),
            t('askFile'))));
}

};
__defs["html-bridge"] = function (module, exports, require) {
"use strict";
/** The bridge document: the file's own HTML, plus one selection-reporting script. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_HTML_CHARS = exports.HTML_BRIDGE = void 0;
exports.childBridge = childBridge;
exports.buildBridgeDocument = buildBridgeDocument;
exports.previewIdentity = previewIdentity;
exports.HTML_BRIDGE = 'dsh-explainer/html-selection/v1';
/** A rendered report is a working document, not an attachment; 8 MB is plenty. */
exports.MAX_HTML_CHARS = 8000000;
/**
 * The script that runs inside the opaque preview frame. It only reads the
 * current selection and reports it to the parent; it has no file, model or
 * parent-DOM access, and it never sends anything the page did not select.
 */
function childBridge(channel) {
    let sequence = 0;
    let timer = 0;
    const send = (action, payload = {}) => {
        parent.postMessage({ type: 'dsh-explainer/html-selection/v1', channel, sequence: ++sequence, action, ...payload }, '*');
    };
    const selected = () => {
        const selection = window.getSelection();
        if (selection === null || selection.isCollapsed || selection.rangeCount !== 1)
            return null;
        const range = selection.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const element = node.nodeType === 1 ? node : node.parentElement;
        if (element === null || element.closest('input,textarea,select,[contenteditable]'))
            return null;
        const text = selection.toString().trim().slice(0, 6000);
        if (text.length < 2)
            return null;
        const rects = range.getClientRects();
        const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
        return { text, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } };
    };
    const report = () => {
        const value = selected();
        send(value ? 'hint' : 'clear', value ?? {});
    };
    document.addEventListener('pointerdown', () => send('outside'), true);
    document.addEventListener('pointerup', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(report, 20);
    }, true);
    document.addEventListener('selectionchange', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(report, 160);
    });
    document.addEventListener('contextmenu', event => {
        const value = selected();
        if (value !== null) {
            event.preventDefault();
            send('open', value);
        }
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape')
            send('escape');
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
            const value = selected();
            if (value !== null) {
                event.preventDefault();
                send('open', value);
            }
        }
    }, true);
    document.addEventListener('scroll', () => send('clear'), true);
}
/** Generate one opaque preview document that keeps the file's own rendering. */
function buildBridgeDocument(source, channel) {
    if (source.length > exports.MAX_HTML_CHARS)
        throw new Error('HTML 文件超过 8 MB，划词预览暂不支持这么大的文件。');
    if (!/^[a-f0-9]{32,}$/.test(channel))
        throw new Error('Invalid preview identity');
    const script = `<script>(${childBridge.toString()})(${JSON.stringify(channel)});</script>`;
    // Insert before </body> when there is one so the bridge runs after the page's
    // own scripts; otherwise append (the document still executes top to bottom).
    const close = source.toLowerCase().lastIndexOf('</body>');
    return close === -1 ? source + script : source.slice(0, close) + script + source.slice(close);
}
/** A fresh per-document channel; the parent only accepts messages on it. */
function previewIdentity() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

};
__defs["html-preview"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlSelectionPreview = HtmlSelectionPreview;
const React = __importStar(require("react"));
const html_receiver_1 = require("./html-receiver");
const html_bridge_1 = require("./html-bridge");
/**
 * The default HTML renderer: the file's own document inside an opaque frame,
 * plus a selection bridge. Scripts, inline styles and data images render as
 * authored; the frame has no same-origin, so the page never reaches the app.
 */
function HtmlSelectionPreview(props) {
    const { source, path, sessionId, store } = props;
    const frame = React.useRef(null);
    const prepared = React.useMemo(() => {
        try {
            const channel = (0, html_bridge_1.previewIdentity)();
            return { channel, html: (0, html_bridge_1.buildBridgeDocument)(source, channel) };
        }
        catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    }, [source]);
    const url = React.useMemo(() => {
        if (!('html' in prepared))
            return null;
        return URL.createObjectURL(new Blob([prepared.html], { type: 'text/html' }));
    }, [prepared]);
    React.useEffect(() => {
        const element = frame.current;
        if (!element || url === null || !('channel' in prepared))
            return;
        const dispose = (0, html_receiver_1.bindHtmlBridge)(element, prepared.channel, path, {
            hint: value => (value ? store.showHint(value.text, value.rect, path, sessionId) : store.hideHint()),
            open: value => store.openSelection(value.rect, value.text, path, sessionId),
            outside: () => store.close(),
            escape: () => (store.getSnapshot().card?.phase === 'streaming' ? store.stop() : store.close()),
            enabled: () => store.getSnapshot().config?.enabled !== false,
            rightClick: () => store.getSnapshot().config?.rightClick !== false,
        });
        return dispose;
    }, [url, prepared, path, sessionId, store]);
    React.useEffect(() => () => { if (url !== null)
        URL.revokeObjectURL(url); }, [url]);
    if ('error' in prepared)
        return React.createElement("p", { role: "alert", className: "dx-html-error" }, prepared.error);
    if (url === null)
        return React.createElement("p", { className: "dx-html-error" }, "\u6B63\u5728\u51C6\u5907 HTML \u9884\u89C8\u2026");
    return React.createElement("iframe", { ref: frame, className: "dx-html-frame", src: url, sandbox: "allow-scripts allow-popups allow-downloads allow-modals", referrerPolicy: "no-referrer", title: "HTML \u5212\u8BCD\u9884\u89C8" });
}

};
__defs["html-receiver"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindHtmlBridge = bindHtmlBridge;
const html_bridge_1 = require("./html-bridge");
const preview_frames_1 = require("./preview-frames");
/** Source, per-document identity, sequence and bounded viewport validation. */
function bindHtmlBridge(frame, channel, filePath, callbacks) {
    const owner = frame.ownerDocument.defaultView;
    if (!owner)
        return () => { };
    let sequence = 0;
    let start = 0;
    let count = 0;
    let live = true;
    const receive = (event) => {
        if (!live || !frame.isConnected || !callbacks.enabled() || event.source !== frame.contentWindow)
            return;
        const value = event.data;
        if (value === null || typeof value !== 'object')
            return;
        const msg = value;
        if (msg.type !== html_bridge_1.HTML_BRIDGE || msg.channel !== channel
            || !Number.isSafeInteger(msg.sequence) || msg.sequence <= sequence)
            return;
        const now = performance.now();
        if (now - start > 1000) {
            start = now;
            count = 0;
        }
        if (++count > 40)
            return;
        sequence = msg.sequence;
        if (msg.action === 'clear') {
            callbacks.hint(null);
            return;
        }
        if (msg.action === 'outside') {
            callbacks.outside();
            return;
        }
        if (msg.action === 'escape') {
            callbacks.escape();
            return;
        }
        if (msg.action !== 'hint' && msg.action !== 'open')
            return;
        if (typeof msg.text !== 'string' || msg.text.length < 2 || msg.text.length > 6000)
            return;
        if (msg.rect === null || typeof msg.rect !== 'object')
            return;
        const r = msg.rect;
        const keys = ['left', 'top', 'right', 'bottom'];
        if (!keys.every(key => typeof r[key] === 'number' && Number.isFinite(r[key])))
            return;
        const left = r.left, top = r.top, right = r.right, bottom = r.bottom;
        if (right <= left || bottom <= top || left < -1 || top < -1
            || right > frame.clientWidth + 2 || bottom > frame.clientHeight + 2)
            return;
        const rect = (0, preview_frames_1.previewRect)(frame, { left, top, right, bottom, width: right - left, height: bottom - top });
        if (!rect)
            return;
        const selection = { kind: 'file', text: msg.text, rect, filePath };
        if (msg.action === 'open' && callbacks.rightClick())
            callbacks.open(selection);
        else
            callbacks.hint(selection);
    };
    owner.addEventListener('message', receive);
    const clear = () => callbacks.hint(null);
    owner.addEventListener('resize', clear);
    owner.addEventListener('scroll', clear, true);
    return () => {
        live = false;
        owner.removeEventListener('message', receive);
        owner.removeEventListener('resize', clear);
        owner.removeEventListener('scroll', clear, true);
        callbacks.hint(null);
    };
}

};
__defs["html-registration"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.installHtmlPreviews = installHtmlPreviews;
const React = __importStar(require("react"));
const html_preview_1 = require("./html-preview");
function decode(content) {
    if (content === null || typeof content !== 'object')
        return '';
    const value = content;
    if (value.kind !== 'bytes' || !(value.data instanceof Uint8Array))
        return '';
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(value.data);
    }
    catch {
        return '';
    }
}
/**
 * Register the HTML selection renderer as the default HTML implementation.
 *
 * It is an "extension" registration, so the viewer menu still offers the
 * shipped preview: a file whose scripts need the host's resource packing can
 * be switched back, and nothing is removed.
 */
function installHtmlPreviews(ctx, store) {
    // 1. Native document preview (right sidebar).
    ctx.inject?.(['documentPreviews'], scope => {
        const registry = scope.get?.('documentPreviews');
        if (!registry?.register)
            return;
        const id = 'dsh-explainer/html';
        scope.effect(() => registry.register({
            id,
            extensions: ['html', 'htm'],
            priority: 'extension',
            title: () => 'HTML（划词）',
            loading: 'bytes-complete',
            wrap: false,
        }), 'explainer: HTML selection renderer');
        scope.slots.inject('sidebar.right.tab.document', () => scope.slots.register({
            name: 'sidebar.right.tab.document',
            key: id,
        }, (props) => {
            const resource = props.useResource?.(props.resourceAddress);
            const path = resource?.value?.absolutePath;
            const source = decode(props.content);
            if (typeof path !== 'string' || path === '')
                return React.createElement("p", null, "\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6\u8DEF\u5F84\u2026");
            return React.createElement(html_preview_1.HtmlSelectionPreview, { key: props.resourceAddress, source: source, path: path, sessionId: props.sessionId, store: store });
        }));
    });
    // 2. better-sidebar's editor, when that plugin is installed.
    ctx.inject?.(['betterSidebar'], scope => {
        const service = scope.get?.('betterSidebar');
        if (!service?.getFileViewers || !service?.registerFileViewer)
            return;
        const original = service.getFileViewers().find((viewer) => viewer.id === 'html');
        if (!original)
            return;
        function BetterHtml(props) {
            const source = typeof props.content === 'string' ? props.content : '';
            return React.createElement(html_preview_1.HtmlSelectionPreview, { key: props.path, source: source, path: props.path, sessionId: props.scope?.sessionId ?? props.sessionId, store: store });
        }
        scope.effect(() => service.registerFileViewer({
            id: 'explainer-html', title: () => 'HTML（划词）',
            exts: ['html', 'htm'], priority: (original.priority ?? 0) + 1,
            fetchStrategy: 'fsRead', component: BetterHtml,
        }), 'explainer: better-sidebar HTML renderer');
    });
}

};
__defs["index"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = exports.inject = void 0;
exports.apply = apply;
const React = __importStar(require("react"));
const store_1 = require("./store");
const overlay_1 = require("./overlay");
const composer_1 = require("./composer");
const file_marker_1 = require("./file-marker");
const html_registration_1 = require("./html-registration");
const locales_1 = require("./locales");
const styles_1 = require("./styles");
var meta_1 = require("./meta");
Object.defineProperty(exports, "inject", { enumerable: true, get: function () { return meta_1.inject; } });
Object.defineProperty(exports, "name", { enumerable: true, get: function () { return meta_1.name; } });
/**
 * Browser half of 快问.
 *
 * Two additive seats: a frame-wide floating layer for the selection pill and
 * the quick-ask window, and a composer entry for the launcher plus the
 * session-scoped bridge. Both share one store created here, closed over by the
 * components, and disposed with the plugin fiber.
 */
function apply(ctx) {
    const store = new store_1.ExplainerStore();
    ctx.effect(() => {
        const style = document.createElement('style');
        style.setAttribute('data-dsh-explainer', '');
        style.textContent = styles_1.STYLES;
        document.head.appendChild(style);
        return () => { style.remove(); };
    }, 'explainer: styles');
    ctx.effect(() => ctx.locale.register('explainer', locales_1.STRINGS), 'explainer: dictionaries');
    const t = ctx.locale.bind('explainer');
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'explainer.window', order: 520 }, (props) => React.createElement(overlay_1.Overlay, {
        store,
        t,
        useSessions: props['useSessions'],
    })));
    // The right sidebar's document preview gets a hidden marker carrying the
    // previewed file's absolute path; selection detection reads it back.
    ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({ name: 'sidebar.right.tab.document.actions', id: 'explainer.file-context', order: 500 }, (props) => React.createElement(file_marker_1.FileMarker, {
        store,
        t,
        absolutePath: props['absolutePath'],
    })));
    // Optional HTML preview entry points: registered last, so a missing service
    // never affects the core seats above.
    (0, html_registration_1.installHtmlPreviews)(ctx, store);
    ctx.slots.inject('conversation.input.right', () => ctx.slots.register({ name: 'conversation.input.right', id: 'explainer.quick', order: 260, label: () => t('quickAsk') }, (props) => React.createElement(composer_1.ComposerButton, {
        store,
        t,
        sessionId: props['sessionId'],
        inputActions: props['inputActions'],
        useInput: props['useInput'],
        useProjection: props['useProjection'],
    })));
}

};
__defs["locales"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRINGS = void 0;
/** User-facing copy, keyed by language. */
exports.STRINGS = {
    zh: {
        quickAsk: '快问',
        askSelection: '问这段',
        rightClickHint: '选中文字后，右键也能直接打开',
        askFile: '问一下',
        placeholderFile: '想问这个文件什么？（回车＝概括全文）',
        placeholderSelection: '想问什么？（回车＝解释这段）',
        placeholderQuick: '问点什么…（回车发送）',
        placeholderFollow: '继续问…',
        placeholderTranslate: '正在自动翻译…（输入可改问法）',
        placeholderTerm: '正在自动解释…（输入可改问法）',
        placeholderQuestion: '正在自动回答…（输入可改问法）',
        send: '发送',
        stop: '停止',
        close: '关闭',
        newThread: '新对话',
        copy: '复制',
        copied: '已复制',
        copyFailed: '复制失败',
        insert: '插入输入框',
        inserted: '已插入输入框',
        escalate: '发主会话',
        escalated: '已填入主会话输入框',
        retry: '重试',
        inheritOn: '继承对话上下文',
        inheritOff: '不继承上下文',
        inheritHint: '只读快照，不会修改主对话。',
        contextChars: '已继承 {n} 字上下文',
        emptySelection: '写一句想问的，或直接回车让我解释选中的这段。',
        emptyQuick: '直接问，答案不会写进主会话。',
        noBridge: '当前没有可用的会话输入框',
        stopped: '已停止',
        timeout: '回答超时，请重试',
        presetExplain: '解释',
        presetTranslate: '翻译成中文',
        presetSummary: '一句话总结',
        presetExample: '举个例子',
        presetTranslateQuestion: '翻译成中文',
        presetSummaryQuestion: '用一句话总结',
        presetExampleQuestion: '举个例子',
        inheritedBadge: '已继承上下文',
        plainBadge: '独立对话',
        sessionAsk: '发给主会话深答',
        chars: '字',
        expand: '展开',
        collapse: '收起',
        minimize: '收起窗口',
        sameModel: '与主窗口相同的模型',
        pinnedModel: '插件指定的弹窗默认模型（主对话的可选模型中之一）',
        effortOff: '不思考',
        effortMinimal: '极简思考',
        effortLow: '低思考',
        effortMedium: '中思考',
        effortHigh: '高思考',
        effortXhigh: '极高思考',
        effortMax: '最高思考',
        selectFirst: '先在对话里选中一段文字',
        busy: '上一条还在生成，稍等一下',
        noModel: '没有可用的模型，请先在设置里配置',
        emptyAnswer: '模型没有返回内容，可以重试'
    },
    en: {
        quickAsk: 'Quick Ask',
        askSelection: 'Ask about this',
        rightClickHint: 'Right-click a selection to open this window',
        askFile: 'Ask',
        placeholderFile: 'Ask about this file (Enter = summarize it)',
        placeholderSelection: 'Ask anything (Enter = explain this)',
        placeholderQuick: 'Ask something… (Enter to send)',
        placeholderFollow: 'Ask a follow-up…',
        placeholderTranslate: 'Translating automatically… (type to change the question)',
        placeholderTerm: 'Explaining automatically… (type to change the question)',
        placeholderQuestion: 'Answering automatically… (type to change the question)',
        send: 'Send',
        stop: 'Stop',
        close: 'Close',
        newThread: 'New conversation',
        copy: 'Copy',
        copied: 'Copied',
        copyFailed: 'Copy failed',
        insert: 'Insert into composer',
        inserted: 'Inserted into the composer',
        escalate: 'Send to the main chat',
        escalated: 'Put into the main composer',
        retry: 'Retry',
        inheritOn: 'Inherit chat context',
        inheritOff: 'Isolated',
        inheritHint: 'A read-only snapshot; the main chat is never modified.',
        contextChars: 'Inherited {n} chars of context',
        emptySelection: 'Type a question, or press Enter to explain the selection.',
        emptyQuick: 'Ask away. The answer never enters the main conversation.',
        noBridge: 'No composer is available in this view',
        stopped: 'Stopped',
        timeout: 'The answer timed out. Try again.',
        presetExplain: 'Explain',
        presetTranslate: 'Translate',
        presetSummary: 'Summarize',
        presetExample: 'Example',
        presetTranslateQuestion: 'Translate into Chinese',
        presetSummaryQuestion: 'Summarize in one sentence',
        presetExampleQuestion: 'Give an example',
        inheritedBadge: 'Context inherited',
        plainBadge: 'Isolated',
        sessionAsk: 'Ask the main agent to go deeper',
        chars: 'chars',
        expand: 'Expand',
        collapse: 'Collapse',
        minimize: 'Collapse window',
        sameModel: 'Same model as the main window',
        pinnedModel: 'Default model chosen by the plugin (one of the main chat\'s models)',
        effortOff: 'no thinking',
        effortMinimal: 'minimal thinking',
        effortLow: 'low thinking',
        effortMedium: 'medium thinking',
        effortHigh: 'high thinking',
        effortXhigh: 'extra-high thinking',
        effortMax: 'max thinking',
        selectFirst: 'Select some text in the chat first',
        busy: 'The previous answer is still running',
        noModel: 'No model is configured yet',
        emptyAnswer: 'The model returned nothing; try again'
    }
};

};
__defs["markdown"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Markdown = void 0;
const React = __importStar(require("react"));
/**
 * A deliberately small Markdown renderer.
 *
 * It builds React elements from tokens instead of setting HTML, so model
 * output can never inject markup. The syntax subset is the one quick answers
 * actually use: paragraphs, short lists, fenced code, headings, quotes, bold,
 * inline code and absolute links.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
function safeHref(raw) {
    try {
        const url = new URL(raw);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
    }
    catch {
        return undefined;
    }
}
function renderInline(text) {
    const nodes = [];
    let last = 0;
    let key = 0;
    INLINE.lastIndex = 0;
    let match = INLINE.exec(text);
    while (match !== null) {
        const token = match[0];
        if (match.index > last)
            nodes.push(text.slice(last, match.index));
        if (token.startsWith('**')) {
            nodes.push(React.createElement('strong', { key: `b${key}` }, token.slice(2, -2)));
        }
        else if (token.startsWith('`')) {
            nodes.push(React.createElement('code', { key: `c${key}` }, token.slice(1, -1)));
        }
        else {
            const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
            const href = link === null ? undefined : safeHref(link[2] ?? '');
            if (link !== null && href !== undefined) {
                nodes.push(React.createElement('a', {
                    key: `a${key}`,
                    href,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                }, link[1]));
            }
            else {
                nodes.push(token);
            }
        }
        key += 1;
        last = match.index + token.length;
        match = INLINE.exec(text);
    }
    if (last < text.length)
        nodes.push(text.slice(last));
    return nodes;
}
/** Render one answer. Memoized by `text` at the component boundary. */
exports.Markdown = React.memo(function Markdown({ text }) {
    const blocks = [];
    const lines = text.split('\n');
    let index = 0;
    let key = 0;
    const pushParagraph = () => {
        const paragraph = [];
        while (index < lines.length) {
            const line = lines[index] ?? '';
            if (line.trim() === '' || /^\s*(```|#{1,3}\s|[-*•]\s|\d+[.)]\s|>)/.test(line))
                break;
            paragraph.push(line);
            index += 1;
        }
        if (paragraph.length === 0)
            return;
        blocks.push(React.createElement('p', { key: key++ }, ...renderInline(paragraph.join('\n'))));
    };
    while (index < lines.length) {
        const line = lines[index] ?? '';
        if (line.trim() === '') {
            index += 1;
            continue;
        }
        if (/^```/.test(line)) {
            const code = [];
            index += 1;
            while (index < lines.length && !/^```/.test(lines[index] ?? '')) {
                code.push(lines[index] ?? '');
                index += 1;
            }
            index += 1;
            blocks.push(React.createElement('pre', { key: key++ }, React.createElement('code', null, code.join('\n'))));
            continue;
        }
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        if (heading !== null) {
            const level = Math.min(3, (heading[1] ?? '#').length);
            blocks.push(React.createElement(`h${level}`, { key: key++ }, ...renderInline(heading[2] ?? '')));
            index += 1;
            continue;
        }
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (bullet !== null) {
            const items = [];
            while (index < lines.length) {
                const item = /^\s*[-*•]\s+(.*)$/.exec(lines[index] ?? '');
                if (item === null)
                    break;
                items.push(React.createElement('li', { key: items.length }, ...renderInline(item[1] ?? '')));
                index += 1;
            }
            blocks.push(React.createElement('ul', { key: key++ }, ...items));
            continue;
        }
        const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        if (ordered !== null) {
            const items = [];
            while (index < lines.length) {
                const item = /^\s*(\d+)[.)]\s+(.*)$/.exec(lines[index] ?? '');
                if (item === null)
                    break;
                items.push(React.createElement('li', { key: items.length }, ...renderInline(item[2] ?? '')));
                index += 1;
            }
            blocks.push(React.createElement('ol', { key: key++ }, ...items));
            continue;
        }
        if (/^>\s?/.test(line)) {
            const quote = [];
            while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
                quote.push((lines[index] ?? '').replace(/^>\s?/, ''));
                index += 1;
            }
            blocks.push(React.createElement('blockquote', { key: key++ }, ...renderInline(quote.join('\n'))));
            continue;
        }
        pushParagraph();
    }
    return React.createElement('div', { className: 'dx-md' }, ...blocks);
});

};
__defs["meta"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = exports.name = void 0;
/** Loader identity of the browser half; the bundle row name must equal the package name. */
exports.name = 'dsh-explainer';
/** Client services this entry needs before it may register UI. */
exports.inject = ['slots', 'locale'];

};
__defs["overlay"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Overlay = Overlay;
const React = __importStar(require("react"));
const markdown_1 = require("./markdown");
const selection_1 = require("./selection");
const preview_frames_1 = require("./preview-frames");
const use_store_1 = require("./use-store");
const WIDTH = 440;
const MARGIN = 12;
/** Human labels for the adapter-owned reasoning effort ids. */
const EFFORT_LABELS = {
    off: 'effortOff',
    minimal: 'effortMinimal',
    low: 'effortLow',
    medium: 'effortMedium',
    high: 'effortHigh',
    xhigh: 'effortXhigh',
    max: 'effortMax',
};
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}
function friendlyError(turn, t) {
    switch (turn.errorCode) {
        case 'timeout': return t('timeout');
        case 'aborted': return t('stopped');
        case 'busy': return t('busy');
        case 'no-model': return t('noModel');
        case 'empty-answer': return t('emptyAnswer');
        default: return turn.error ?? t('emptyAnswer');
    }
}
/** Position the window under the anchor, flipping above when it fits better. */
function place(card) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(WIDTH, viewportWidth - MARGIN * 2);
    if (card.position !== null) {
        const x = clamp(card.position.x, MARGIN, viewportWidth - width - MARGIN);
        const y = clamp(card.position.y, MARGIN, viewportHeight - 160);
        return { left: x, top: y, width, maxHeight: viewportHeight - y - MARGIN };
    }
    const anchor = card.anchor;
    const below = anchor.bottom + 8;
    const roomBelow = viewportHeight - below - MARGIN;
    const roomAbove = anchor.top - 8 - MARGIN;
    const width2 = width;
    const left = clamp(anchor.left, MARGIN, viewportWidth - width2 - MARGIN);
    if (roomBelow >= 300 || roomBelow >= roomAbove) {
        return { left, top: Math.max(MARGIN, below), width: width2, maxHeight: Math.max(220, roomBelow) };
    }
    return { left, bottom: viewportHeight - anchor.top + 8, width: width2, maxHeight: Math.max(220, roomAbove) };
}
/** The floating layer: the selection pill, the quick-ask window and a toast. */
function Overlay(props) {
    const { store, t, useSessions } = props;
    const snapshot = (0, use_store_1.useStore)(store, value => value);
    const sessionId = useSessions(state => {
        for (const [id, entry] of Object.entries(state.byId)) {
            if ((entry.retainedBy?.mainView ?? 0) > 0)
                return id;
        }
        return undefined;
    });
    React.useEffect(() => {
        void store.ensureConfig();
    }, [store]);
    React.useEffect(() => {
        store.setSessionId(typeof sessionId === 'string' ? sessionId : null);
    }, [store, sessionId]);
    React.useEffect(() => {
        let pointerDown = false;
        let timer = 0;
        const compute = () => {
            const found = (0, selection_1.readSelection)();
            if (found === null)
                store.hideHint();
            else
                store.showHint(found.text, found.rect, found.filePath);
        };
        const onDown = () => { pointerDown = true; };
        const onUp = () => {
            pointerDown = false;
            window.clearTimeout(timer);
            timer = window.setTimeout(compute, 16);
        };
        const onSelectionChange = () => {
            if (pointerDown)
                return;
            window.clearTimeout(timer);
            timer = window.setTimeout(compute, 160);
        };
        const onScroll = () => { store.hideHint(); };
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('selectionchange', onSelectionChange);
        document.addEventListener('scroll', onScroll, true);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('pointerup', onUp, true);
            document.removeEventListener('selectionchange', onSelectionChange);
            document.removeEventListener('scroll', onScroll, true);
        };
    }, [store]);
    React.useEffect(() => (0, preview_frames_1.observePreviewFrames)(document, {
        hint: found => {
            if (found === null)
                store.hideHint();
            else
                store.showHint(found.text, found.rect, found.filePath);
        },
        open: found => store.openSelection(found.rect, found.text, found.filePath),
        pointerDown: () => store.close(),
        enabled: () => store.getSnapshot().config?.enabled !== false,
        rightClick: () => store.getSnapshot().config?.rightClick !== false,
        escape: () => {
            if (store.getSnapshot().card?.phase === 'streaming')
                store.stop();
            else
                store.close();
        },
    }), [store]);
    // Clicking anywhere outside the window closes it. The launcher and the
    // selection pill keep their own click behaviour.
    React.useEffect(() => {
        const onPointerDown = (event) => {
            const target = event.target;
            if (target === null)
                return;
            if (target.closest('.dx-card, .dx-pill, .dx-launcher') !== null)
                return;
            store.close();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => { document.removeEventListener('pointerdown', onPointerDown, true); };
    }, [store]);
    // Selecting text and right-clicking opens the window directly. Registered in
    // the capture phase so a host menu cannot swallow it, and only when the
    // capture is a valid chat selection.
    React.useEffect(() => {
        const onContextMenu = (event) => {
            const snapshot = store.getSnapshot();
            if (snapshot.config?.enabled === false || snapshot.config?.rightClick === false)
                return;
            const target = event.target;
            if (target === null)
                return;
            if (target.closest('.dx-card, .dx-pill, .dx-launcher') !== null)
                return;
            const found = (0, selection_1.readSelection)();
            if (found === null)
                return;
            event.preventDefault();
            store.openSelection(found.rect, found.text, found.filePath);
        };
        document.addEventListener('contextmenu', onContextMenu, true);
        return () => { document.removeEventListener('contextmenu', onContextMenu, true); };
    }, [store]);
    React.useEffect(() => {
        const onKeyDown = (event) => {
            const mod = event.ctrlKey || event.metaKey;
            if (mod && event.shiftKey && (event.key === 'K' || event.key === 'k')) {
                event.preventDefault();
                const rect = (0, selection_1.findComposerRect)();
                if (rect === null)
                    store.notify(t('noBridge'));
                else
                    store.openQuick(rect);
                return;
            }
            if (mod && event.shiftKey && (event.key === 'E' || event.key === 'e')) {
                event.preventDefault();
                const found = (0, selection_1.readSelection)();
                if (found === null)
                    store.notify(t('selectFirst'));
                else
                    store.openSelection(found.rect, found.text, found.filePath);
                return;
            }
            if (event.key === 'Escape') {
                const card = store.getSnapshot().card;
                if (card !== null && card.phase === 'streaming')
                    store.stop();
                else if (card !== null)
                    store.close();
                else
                    store.hideHint();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => { window.removeEventListener('keydown', onKeyDown, true); };
    }, [store, t]);
    const hint = snapshot.hint;
    const card = snapshot.card;
    const notice = snapshot.notice;
    return (React.createElement(React.Fragment, null,
        hint !== null && (React.createElement("button", { type: "button", className: "dx-pill", style: {
                left: clamp(hint.rect.left, MARGIN, window.innerWidth - 150),
                top: clamp(hint.rect.bottom + 8, MARGIN, window.innerHeight - 44),
            }, title: t('rightClickHint'), onMouseDown: event => event.preventDefault(), onClick: () => store.openSelection(hint.rect, hint.text, hint.filePath, hint.sessionId) },
            React.createElement("span", { className: "dx-spark" }, "\u2726"),
            t('askSelection'))),
        card !== null && (React.createElement(Card, { store: store, card: card, t: t, showMeta: snapshot.config?.showMeta ?? true, hasBridge: snapshot.bridge !== null, route: store.effectiveRoute(), pinned: store.isPinnedModel() })),
        notice !== null && React.createElement("div", { className: "dx-toast" }, notice.text)));
}
/** The quick-ask window: header, quote, transcript, presets and a always-on composer. */
function Card(props) {
    const { store, card, t, showMeta, hasBridge, route, pinned } = props;
    const inputRef = React.useRef(null);
    const bodyRef = React.useRef(null);
    const cardRef = React.useRef(null);
    const drag = React.useRef(null);
    const [, tick] = React.useState(0);
    React.useEffect(() => {
        const onResize = () => tick(value => value + 1);
        window.addEventListener('resize', onResize);
        return () => { window.removeEventListener('resize', onResize); };
    }, []);
    // Focus the composer once per thread, not on every phase change: after an
    // answer the user may be reading, and stealing focus would be hostile.
    React.useEffect(() => {
        if (card.phase !== 'streaming')
            inputRef.current?.focus();
    }, [card.threadId]);
    const last = card.messages[card.messages.length - 1];
    const lastText = last?.text ?? '';
    React.useEffect(() => {
        const element = bodyRef.current;
        if (element === null)
            return;
        const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
        if (nearBottom)
            element.scrollTop = element.scrollHeight;
    }, [card.messages.length, lastText]);
    React.useEffect(() => {
        const element = inputRef.current;
        if (element === null)
            return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(132, Math.max(36, element.scrollHeight))}px`;
    }, [card.draft]);
    const onPointerDown = (event) => {
        const target = event.target;
        if (target.closest('button') !== null)
            return;
        const element = cardRef.current;
        if (element === null)
            return;
        const rect = element.getBoundingClientRect();
        drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };
    const onPointerMove = (event) => {
        const state = drag.current;
        if (state === null)
            return;
        const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2);
        const x = clamp(state.left + event.clientX - state.x, MARGIN, window.innerWidth - width - MARGIN);
        const y = clamp(state.top + event.clientY - state.y, MARGIN, window.innerHeight - 160);
        store.moveTo(x, y);
    };
    const onPointerUp = () => { drag.current = null; };
    const streaming = card.phase === 'streaming';
    const canSend = streaming || card.draft.trim() !== '' || (card.messages.length === 0 && card.mode === 'selection');
    const placeholder = card.messages.length === 0
        ? (card.mode === 'selection'
            ? (card.filePath !== undefined && card.quote === ''
                ? t('placeholderFile')
                : (0, selection_1.selectionShape)(card.quote) === 'english-prose'
                    ? t('placeholderTranslate')
                    : (0, selection_1.selectionShape)(card.quote) === 'term'
                        ? t('placeholderTerm')
                        : ((0, selection_1.selectionShape)(card.quote) === 'question' ? t('placeholderQuestion') : t('placeholderSelection')))
            : t('placeholderQuick'))
        : t('placeholderFollow');
    const presets = [
        { id: 'explain', label: t('presetExplain'), question: '' },
        { id: 'translate', label: t('presetTranslate'), question: t('presetTranslateQuestion') },
        { id: 'summary', label: t('presetSummary'), question: t('presetSummaryQuestion') },
        { id: 'example', label: t('presetExample'), question: t('presetExampleQuestion') },
    ];
    return (React.createElement("div", { ref: cardRef, className: "dx-card", style: place(card), "data-explainer-card": "", role: "dialog", "aria-label": t('quickAsk') },
        React.createElement("div", { className: "dx-head", onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp },
            React.createElement("span", { className: "dx-title" },
                React.createElement("span", { className: "dx-spark" }, "\u2726"),
                card.mode === 'selection' ? t('askSelection') : t('quickAsk')),
            card.filePath !== undefined && (React.createElement("span", { className: "dx-badge dx-file", title: card.filePath }, card.filePath.split(/[\\/]/).pop())),
            route !== null && (React.createElement("span", { className: "dx-badge dx-model", title: pinned ? t('pinnedModel') : t('sameModel') }, route.model)),
            React.createElement("span", { className: "dx-grow" }),
            React.createElement("button", { type: "button", className: "dx-icon", title: t('newThread'), "aria-label": t('newThread'), disabled: card.messages.length === 0 && card.draft === '', onClick: () => store.newThread() }, "\u21BA")),
        card.quote !== '' && (React.createElement("div", { className: "dx-quote", "data-expanded": card.quoteExpanded, onClick: () => store.toggleQuote() }, card.quote)),
        React.createElement("div", { className: "dx-body", ref: bodyRef }, card.messages.map((item, index) => (React.createElement(TurnView, { key: item.id, store: store, t: t, turn: item, hasBridge: hasBridge, isLast: index === card.messages.length - 1 && !streaming })))),
        card.messages.length === 0 && card.mode === 'selection' && (React.createElement("div", { className: "dx-presets" }, presets.map(preset => (React.createElement("button", { key: preset.id, type: "button", className: "dx-chip", onClick: () => {
                store.setDraft(preset.question);
                void store.send();
            } }, preset.label))))),
        React.createElement("div", { className: "dx-compose" },
            React.createElement("textarea", { ref: inputRef, className: "dx-input", rows: 1, value: card.draft, placeholder: placeholder, spellCheck: false, "aria-label": placeholder, onChange: event => store.setDraft(event.target.value), onKeyDown: event => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        if (!streaming)
                            void store.send();
                    }
                } }),
            React.createElement("button", { type: "button", className: "dx-send", "data-mode": streaming ? 'stop' : undefined, title: streaming ? t('stop') : t('send'), "aria-label": streaming ? t('stop') : t('send'), disabled: !canSend, onClick: () => { if (streaming)
                    store.stop();
                else
                    void store.send(); } }, streaming ? '■' : '↑')),
        showMeta && (card.meta !== null || card.phase === 'answer') && (React.createElement(MetaLine, { card: card, t: t }))));
}
async function copyText(text) {
    try {
        if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            return true;
        }
    }
    catch {
        // Fall through to the legacy path: the clipboard API is permission-gated.
    }
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
    }
    catch {
        return false;
    }
}
/** One transcript bubble with its per-answer actions. */
const TurnView = React.memo(function TurnView(props) {
    const { store, t, turn, hasBridge, isLast } = props;
    const assistant = turn.role === 'assistant';
    return (React.createElement("div", { className: "dx-turn", "data-role": turn.role, "data-active": isLast ? 'true' : undefined },
        React.createElement("div", { className: "dx-bubble", "data-error": turn.error !== undefined ? 'true' : undefined },
            assistant
                ? (turn.text !== '' ? React.createElement(markdown_1.Markdown, { text: turn.text }) : null)
                : turn.text,
            turn.streaming === true && React.createElement("span", { className: "dx-cursor" }),
            turn.error !== undefined && React.createElement("div", null, friendlyError(turn, t))),
        assistant && turn.streaming !== true && isLast && (turn.text !== '' || turn.error !== undefined) && (React.createElement("div", { className: "dx-turn-actions" },
            turn.text !== '' && (React.createElement("button", { type: "button", className: "dx-mini", onClick: () => {
                    void copyText(turn.text).then(ok => store.notify(ok ? t('copied') : t('copyFailed')));
                } }, t('copy'))),
            turn.text !== '' && hasBridge && (React.createElement("button", { type: "button", className: "dx-mini", onClick: () => {
                    const ok = store.insertToComposer(turn.text);
                    store.notify(ok ? t('inserted') : t('noBridge'));
                } }, t('insert'))),
            hasBridge && (React.createElement("button", { type: "button", className: "dx-mini", onClick: () => {
                    const ok = store.escalateToSession();
                    store.notify(ok ? t('escalated') : t('noBridge'));
                    if (ok)
                        store.close();
                } }, t('escalate'))),
            turn.error !== undefined && (React.createElement("button", { type: "button", className: "dx-mini", onClick: () => store.retry() }, t('retry')))))));
});
/** The small grey line under the window: route, effort, latency, context size. */
function MetaLine({ card, t }) {
    const meta = card.meta;
    const parts = [];
    if (meta?.model !== undefined && meta.model !== '')
        parts.push(meta.model);
    if (meta?.effort !== undefined && meta.effort !== '') {
        const label = EFFORT_LABELS[meta.effort];
        parts.push(label === undefined ? meta.effort : t(label));
    }
    if (meta?.ms !== undefined)
        parts.push(`${(meta.ms / 1000).toFixed(1)}s`);
    if ((meta?.contextChars ?? 0) > 0)
        parts.push(t('contextChars').replace('{n}', String(meta?.contextChars)));
    if (parts.length === 0)
        return null;
    const nodes = [];
    parts.forEach((part, index) => {
        if (index > 0)
            nodes.push(React.createElement("span", { key: `d${index}`, className: "dx-dot" }, "\u00B7"));
        nodes.push(React.createElement("span", { key: `p${index}` }, part));
    });
    return React.createElement("div", { className: "dx-meta" }, nodes);
}

};
__defs["preview-frames"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessiblePreviewDocument = accessiblePreviewDocument;
exports.previewRect = previewRect;
exports.observePreviewFrames = observePreviewFrames;
const selection_1 = require("./selection");
/** No injection, srcdoc rewrite, sandbox downgrade, or postMessage receiver. */
function accessiblePreviewDocument(frame) {
    if (!frame.isConnected || (0, selection_1.filePathOf)(frame) === undefined)
        return null;
    const sandbox = frame.getAttribute('sandbox');
    // Explicitly reject opaque frames even in DOM emulators that do not enforce SOP.
    if (sandbox !== null && !sandbox.split(/\s+/).includes('allow-same-origin'))
        return null;
    try {
        const doc = frame.contentDocument;
        return doc?.defaultView === null ? null : doc;
    }
    catch {
        return null; // Cross-origin navigation is a normal unsupported preview.
    }
}
/** Map iframe viewport coordinates through borders and axis-aligned CSS scaling. */
function previewRect(frame, rect) {
    const outer = frame.getBoundingClientRect();
    if (outer.width <= 0 || outer.height <= 0 || frame.offsetWidth <= 0 || frame.offsetHeight <= 0)
        return null;
    const sx = outer.width / frame.offsetWidth;
    const sy = outer.height / frame.offsetHeight;
    const left = outer.left + (frame.clientLeft + rect.left) * sx;
    const top = outer.top + (frame.clientTop + rect.top) * sy;
    const right = outer.left + (frame.clientLeft + rect.right) * sx;
    const bottom = outer.top + (frame.clientTop + rect.bottom) * sy;
    const values = [left, top, right, bottom];
    if (!values.every(Number.isFinite) || right <= left || bottom <= top)
        return null;
    const view = frame.ownerDocument.defaultView;
    if (view === null || right <= 0 || bottom <= 0 || left >= view.innerWidth || top >= view.innerHeight
        || right <= outer.left || left >= outer.right || bottom <= outer.top || top >= outer.bottom)
        return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}
/**
 * Observe direct, recognized file-preview frames only. Events do not bubble
 * across documents. Each accessible document gets listeners, not injected JS.
 * Reloads, attribute changes, tab removal and disposal revoke old listeners.
 * Child frames are deliberately not traversed: their content is not necessarily
 * the file identified by the outer preview. All paths come from the parent UI.
 */
function observePreviewFrames(owner, callbacks) {
    const view = owner.defaultView;
    if (view === null)
        return () => { };
    const frames = new Map();
    let disposed = false;
    let queued = false;
    const bind = (frame, doc) => {
        let timer = 0;
        let down = false;
        const current = () => {
            if (!callbacks.enabled() || accessiblePreviewDocument(frame) !== doc)
                return null;
            const path = (0, selection_1.filePathOf)(frame);
            if (path === undefined || doc.defaultView === null)
                return null;
            try {
                const found = (0, selection_1.readSelection)(doc.defaultView, path);
                if (found === null)
                    return null;
                const rect = previewRect(frame, found.rect);
                return rect === null ? null : { ...found, rect };
            }
            catch {
                return null;
            }
        };
        const compute = () => callbacks.hint(current());
        const schedule = (delay) => {
            view.clearTimeout(timer);
            timer = view.setTimeout(compute, delay);
        };
        const onDown = () => { down = true; view.clearTimeout(timer); callbacks.pointerDown(); };
        const onUp = () => { down = false; schedule(16); };
        const onChange = () => { if (!down)
            schedule(160); };
        const onScroll = () => { view.clearTimeout(timer); callbacks.hint(null); };
        const onContext = (event) => {
            if (!callbacks.rightClick())
                return;
            const found = current();
            if (found === null)
                return;
            event.preventDefault();
            view.clearTimeout(timer);
            callbacks.open(found);
        };
        const onKey = (event) => {
            if (!callbacks.enabled())
                return;
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
                const found = current();
                if (found !== null) {
                    event.preventDefault();
                    callbacks.open(found);
                }
            }
            else if (event.key === 'Escape')
                callbacks.escape();
        };
        doc.addEventListener('pointerdown', onDown, true);
        doc.addEventListener('pointerup', onUp, true);
        doc.addEventListener('selectionchange', onChange);
        doc.addEventListener('scroll', onScroll, true);
        doc.addEventListener('contextmenu', onContext, true);
        doc.addEventListener('keydown', onKey, true);
        return () => {
            view.clearTimeout(timer);
            doc.removeEventListener('pointerdown', onDown, true);
            doc.removeEventListener('pointerup', onUp, true);
            doc.removeEventListener('selectionchange', onChange);
            doc.removeEventListener('scroll', onScroll, true);
            doc.removeEventListener('contextmenu', onContext, true);
            doc.removeEventListener('keydown', onKey, true);
        };
    };
    const refresh = (frame) => {
        const state = frames.get(frame);
        if (state === undefined)
            return;
        const doc = accessiblePreviewDocument(frame);
        const path = (0, selection_1.filePathOf)(frame);
        if (doc === state.doc && path === state.path)
            return;
        state.detach();
        callbacks.hint(null);
        state.doc = doc;
        state.path = path;
        state.detach = doc === null ? () => { } : bind(frame, doc);
    };
    const scan = () => {
        queued = false;
        if (disposed)
            return;
        for (const [frame, state] of frames) {
            if (!frame.isConnected || (0, selection_1.filePathOf)(frame) === undefined) {
                state.detach();
                frame.removeEventListener('load', state.load);
                frames.delete(frame);
                callbacks.hint(null);
            }
        }
        for (const frame of owner.querySelectorAll('iframe')) {
            if ((0, selection_1.filePathOf)(frame) === undefined)
                continue;
            if (!frames.has(frame)) {
                const load = () => refresh(frame);
                frames.set(frame, { doc: null, path: undefined, detach: () => { }, load });
                frame.addEventListener('load', load);
            }
            refresh(frame);
        }
    };
    const observer = new MutationObserver(() => {
        if (!queued && !disposed) {
            queued = true;
            queueMicrotask(scan);
        }
    });
    observer.observe(owner.documentElement, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['sandbox', 'src', 'srcdoc', 'data-explainer-file-path', 'data-textpreview-body',
            'data-textpreview-state', 'data-dsh-pane', 'data-dsh-native-tab-host', 'title'],
    });
    scan();
    const onResize = () => { callbacks.hint(null); scan(); };
    view.addEventListener('resize', onResize);
    return () => {
        disposed = true;
        observer.disconnect();
        view.removeEventListener('resize', onResize);
        for (const [frame, state] of frames) {
            state.detach();
            frame.removeEventListener('load', state.load);
        }
        frames.clear();
    };
}

};
__defs["selection"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEditable = isEditable;
exports.filePathOf = filePathOf;
exports.readSelection = readSelection;
exports.selectionShape = selectionShape;
exports.isEnglishProse = isEnglishProse;
exports.findComposerRect = findComposerRect;
exports.clampBox = clampBox;
/** The conversation message flow, the trajectory view's container, the composer, and the document preview. */
const CHAT_SELECTOR = '[data-slot="conversation.chat.flow"]';
const MAIN_SELECTOR = '[data-slot="main.conversation"]';
const COMPOSER_SELECTOR = '[data-slot="conversation.composer"]';
const DOCUMENT_BODY_SELECTOR = '[data-textpreview-body]';
const DOCUMENT_ROOT_SELECTOR = '[data-textpreview-state]';
const FILE_MARKER_SELECTOR = '[data-explainer-file-path]';
/** The better-sidebar editor's native tab host and bottom-workbench pane. */
const BETTER_SIDEBAR_HOSTS = '[data-dsh-native-tab-host], [data-dsh-pane]';
const CARD_ATTR = 'data-explainer-card';
const EDITABLE_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
function elementOf(node) {
    if (node === null)
        return null;
    return node.nodeType === 1 ? node : node.parentElement;
}
/** Whether a node belongs to the composer or any other editable surface. */
function isEditable(node) {
    const element = elementOf(node);
    if (element === null)
        return false;
    if (element.closest(EDITABLE_SELECTOR) !== null)
        return true;
    const html = element;
    return html.isContentEditable === true;
}
function isInsideOurCard(node) {
    const element = elementOf(node);
    return element !== null && element.closest(`[${CARD_ATTR}]`) !== null;
}
/** Whether a node lives in the conversation column rather than the shell around it. */
function inConversation(node) {
    const element = elementOf(node);
    if (element === null)
        return false;
    if (element.closest(COMPOSER_SELECTOR) !== null)
        return false;
    return element.closest(CHAT_SELECTOR) !== null || element.closest(MAIN_SELECTOR) !== null;
}
/**
 * The absolute path published by the document preview's toolbar marker for the
 * preview root that contains this node. Inactive tabs keep their own marker,
 * so matching on the enclosing root avoids reporting another tab's file.
 */
function documentPathOf(node) {
    const element = elementOf(node);
    if (element === null)
        return undefined;
    const body = element.closest(DOCUMENT_BODY_SELECTOR);
    if (body === null)
        return undefined;
    const root = body.closest(DOCUMENT_ROOT_SELECTOR);
    if (root === null)
        return undefined;
    const marker = root.querySelector(FILE_MARKER_SELECTOR);
    const path = marker?.getAttribute('data-explainer-file-path')?.trim();
    return path === undefined || path === '' ? undefined : path;
}
/**
 * The file path the better-sidebar editor shows for the tab that contains
 * this node. Its header renders the path input with `title={path}`; matching
 * on the enclosing pane/native-tab host keeps the answer scoped to the tab
 * the user is selecting in.
 */
function editorPathOf(node) {
    const element = elementOf(node);
    if (element === null)
        return undefined;
    const host = element.closest(BETTER_SIDEBAR_HOSTS);
    if (host === null)
        return undefined;
    // Editor headers also title plain controls; take the first title that has a
    // path shape, not merely the first input in the pane.
    for (const input of host.querySelectorAll('input[title]')) {
        const path = input.getAttribute('title')?.trim();
        if (path !== undefined && path !== '' && (path.includes('/') || path.includes('\\')))
            return path;
    }
    return undefined;
}
/** Resolve only a known preview/editor surface; never accept a path from iframe content. */
function filePathOf(node) {
    return documentPathOf(node) ?? editorPathOf(node);
}
/** Normalize a DOM selection into plain text while keeping paragraph breaks. */
function selectionText(selection) {
    return selection
        .toString()
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/** The last line of a multi-line selection is where the affordance belongs. */
function selectionRect(range) {
    const rects = range.getClientRects();
    if (rects.length > 0) {
        const last = rects[rects.length - 1];
        if (last !== undefined)
            return last;
    }
    const bounds = range.getBoundingClientRect();
    return bounds.width === 0 && bounds.height === 0 ? null : bounds;
}
/**
 * Read a valid selection from the conversation or from the right sidebar's
 * document preview. The preview needs its file marker (installed by this
 * plugin's toolbar contribution); without one the selection is ignored.
 */
function readSelection(view = window, previewPath) {
    const selection = view.getSelection();
    if (selection === null || selection.isCollapsed || selection.rangeCount === 0)
        return null;
    const range = selection.getRangeAt(0);
    if (range.collapsed)
        return null;
    if (isInsideOurCard(range.commonAncestorContainer))
        return null;
    const text = selectionText(selection);
    if (text.length < 2)
        return null;
    const rect = selectionRect(range);
    if (rect === null)
        return null;
    const capped = text.length > 20000 ? text.slice(0, 20000) : text;
    const common = range.commonAncestorContainer;
    if (previewPath !== undefined) {
        // Embedded preview inputs are UI, not the file being explained.
        if (isEditable(range.startContainer) || isEditable(range.endContainer))
            return null;
        return { kind: 'file', text: capped, rect, filePath: previewPath };
    }
    const filePath = filePathOf(common);
    if (filePath !== undefined && (filePathOf(range.startContainer) !== filePath
        || filePathOf(range.endContainer) !== filePath))
        return null;
    // A file selection may sit in a CodeMirror contenteditable; that is the
    // document being read, not a draft composer, so it is allowed here.
    if (filePath !== undefined)
        return { kind: 'file', text: capped, rect, filePath };
    if (isEditable(common))
        return null;
    if (inConversation(common))
        return { kind: 'chat', text: capped, rect };
    return null;
}
const WORD = /[A-Za-z][A-Za-z'\u2019-]*/g;
const CJK = /[\u3400-\u9fff\u3040-\u30ff]/g;
const CODE = /[{}<>\x60=]|=>|\bfunction\b|\bconst\b|\bimport\b|\bdef\b|\bclass\b|\breturn\b/;
const FINITE = /\b(is|are|was|were|be|been|has|have|had|does|do|did|can|could|will|would|shall|should|may|might|must|means|refers|describes|explains|allows|requires|contains|includes|supports|provides|creates|makes|uses|happens|works|becomes|seems|appears|shows|needs|returns|calls|says|tells|thinks|knows|sees|comes|goes|gives|takes|finds|keeps|holds|carries|brings|adds|removes|reads|writes|loads|saves|opens|closes|starts|stops|sends|receives|waits|fails|succeeds|exists)\b/i;
const FILLER_START = /^(?:the\s+)?(?:concept|notion|idea|term|definition|meaning)\s+of\s+|^what\s+(?:is|are)\s+|^(?:explain|define)\s+|^(?:什么是|所谓|解释一下|解释|这个词|这个概念|术语)\s*/i;
const FILLER_END = /\s*(?:的概念|这个概念|这个术语|术语|是什么意思|指的是什么|指什么|是什么|的定义)\s*[?？!！]?\s*$/;
/**
 * Classify a selection exactly like the host does, so the card can promise
 * the same default and start it without a second round trip.
 * @param text - the selected text.
 * @returns English prose, a noun-phrase term, a question, or anything else.
 */
function selectionShape(input) {
    const original = input.trim();
    if (original === '')
        return 'other';
    if (CODE.test(original))
        return 'other';
    let text = original.replace(FILLER_START, '').replace(FILLER_END, '').trim();
    text = text.replace(/^[「“\x22'(\[]+|[」”\x22')\]]+$/g, '').trim();
    if (text === '')
        return 'other';
    const latin = text.match(WORD) ?? [];
    const cjk = text.match(CJK) ?? [];
    if (latin.length === 0)
        return 'other';
    if (cjk.length >= latin.join('').length / 2)
        return 'other';
    if (/[?？]\s*$/.test(text))
        return 'question';
    const words = latin.length;
    const sentences = (text.match(/[.!?](?=\s+[A-Z0-9])/g) ?? []).length;
    if (words <= 2)
        return 'term';
    if (sentences >= 1)
        return 'english-prose';
    if (words >= 8)
        return 'english-prose';
    if (FINITE.test(text))
        return 'english-prose';
    return 'term';
}
/** Whether a selection reads as English prose. */
function isEnglishProse(text) {
    return selectionShape(text) === 'english-prose';
}
/** Where the quick-ask window opens when there is no selection. */
function findComposerRect() {
    const element = document.querySelector(`${COMPOSER_SELECTOR}, .dsh-composer, [data-slot="conversation.composer.bar"]`);
    if (element === null)
        return null;
    const rect = element.getBoundingClientRect();
    return rect.width === 0 && rect.height === 0 ? null : rect;
}
/** Keep a floating box inside the viewport with a small margin. */
function clampBox(rect, width, height, margin = 12) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - width - margin));
    let top = rect.bottom + 8;
    if (top + height > viewportHeight - margin && rect.top - height - 8 > margin) {
        top = rect.top - height - 8;
    }
    top = Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - height - margin));
    return { left, top };
}

};
__defs["store"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplainerStore = void 0;
const selection_1 = require("./selection");
/** Client fallback when the config route has not answered yet. */
const DEFAULTS = {
    enabled: true,
    maxTokens: 800,
    temperature: 0.3,
    selectionMaxChars: 6000,
    contextMaxChars: 8000,
    contextMaxMessages: 8,
    maxTurns: 3,
    inheritContext: true,
    showMeta: true,
    rightClick: true,
    autoAnswer: true,
    presets: ['explain', 'translate', 'summary', 'example'],
    provider: null,
    model: null,
    defaultModel: null,
    modelGroups: [],
};
/** True when `route` is one of the models `config` says the main chat offers. */
function listedRoute(config, route) {
    const groups = config.modelGroups ?? [];
    if (groups.length === 0)
        return true;
    return groups.some(group => group.id === route.provider
        && group.models.some(model => model.id === route.model));
}
/** A typed transport refusal worth showing verbatim. */
class StreamError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
function newId() {
    const crypto = globalThis.crypto;
    if (crypto !== undefined && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function turn(role, text, extra) {
    return { id: newId(), role, text, ...extra };
}
/** The single browser-side state machine for the pill and the window. */
class ExplainerStore {
    constructor() {
        this.listeners = new Set();
        this.snap = { hint: null, card: null, config: null, bridge: null, sessionId: null, sessionModel: null, defaultRoute: null, notice: null, ready: false };
        this.noticeTimer = 0;
        this.noticeId = 0;
        this.abort = null;
        this.abortReason = null;
        this.raf = 0;
        this.pending = '';
        this.pendingTurnId = '';
        this.generation = 0;
        this.activeGeneration = 0;
        this.configTask = null;
        this.autoTimer = 0;
        this.subscribe = (listener) => {
            this.listeners.add(listener);
            return () => {
                this.listeners.delete(listener);
            };
        };
        this.getSnapshot = () => this.snap;
    }
    emit(patch) {
        this.snap = { ...this.snap, ...patch };
        for (const listener of this.listeners)
            listener();
    }
    patchCard(fn) {
        const card = this.snap.card;
        if (card === null)
            return;
        const next = fn(card);
        if (next !== card)
            this.emit({ card: next });
    }
    /** Cancel a pending auto answer; the user is steering the card. */
    clearAuto() {
        if (this.autoTimer !== 0) {
            window.clearTimeout(this.autoTimer);
            this.autoTimer = 0;
        }
    }
    /* ------------------------------------------------------------------ hint */
    /** The host row can be disabled from the profile; the UI then stays inert. */
    disabled() {
        return this.snap.ready && this.snap.config?.enabled === false;
    }
    showHint(text, rect, filePath, sessionId) {
        if (this.disabled() || this.snap.card !== null)
            return;
        const current = this.snap.hint;
        if (current !== null
            && current.text === text
            && Math.abs(current.rect.left - rect.left) < 2
            && Math.abs(current.rect.top - rect.top) < 2
            && current.filePath === filePath
            && current.sessionId === sessionId)
            return;
        this.emit({ hint: { text, rect, sessionId, ...(filePath === undefined ? {} : { filePath }) } });
    }
    hideHint() {
        if (this.snap.hint !== null)
            this.emit({ hint: null });
    }
    /* ------------------------------------------------------------------ open */
    freshCard(mode, anchor, quote, inheritContext, filePath) {
        return {
            mode,
            quote,
            ...(filePath === undefined ? {} : { filePath }),
            anchor,
            phase: 'input',
            messages: [],
            draft: '',
            meta: null,
            inheritContext,
            quoteExpanded: false,
            threadId: newId(),
            position: null,
            lastQuestion: '',
        };
    }
    openSelection(anchor, text, filePath, sessionId) {
        if (this.disabled())
            return;
        this.clearAuto();
        const config = this.snap.config ?? DEFAULTS;
        const quote = text.slice(0, config.selectionMaxChars);
        const card = { ...this.freshCard('selection', anchor, quote, config.inheritContext, filePath), sessionId };
        this.emit({ hint: null, card });
        this.ensureConfig();
        // A recognized selection answers itself, as the card's placeholder says.
        // Typing (or closing) before the timer fires cancels it and keeps the
        // user's own question as the first turn.
        const shape = (0, selection_1.selectionShape)(quote);
        if ((this.snap.config?.autoAnswer ?? config.autoAnswer) && shape !== 'other' && quote.trim() !== '') {
            const threadId = card.threadId;
            this.autoTimer = window.setTimeout(() => {
                this.autoTimer = 0;
                // The config may have answered after the card opened; honour a later
                // autoAnswer: false instead of sending anyway.
                if (this.snap.config?.autoAnswer === false)
                    return;
                const current = this.snap.card;
                if (current === null || current.threadId !== threadId || current.phase !== 'input' || current.draft.trim() !== '')
                    return;
                void this.send();
            }, 400);
        }
    }
    openQuick(anchor) {
        if (this.disabled())
            return;
        this.clearAuto();
        this.emit({
            hint: null,
            card: this.freshCard('quick', anchor, '', false),
        });
        this.ensureConfig();
    }
    close() {
        this.clearAuto();
        this.stop(true);
        this.emit({ card: null, hint: null });
    }
    /* --------------------------------------------------------------- actions */
    setDraft(draft) {
        if (draft.trim() !== '')
            this.clearAuto();
        this.patchCard(card => (card.draft === draft ? card : { ...card, draft }));
    }
    toggleQuote() {
        this.patchCard(card => ({ ...card, quoteExpanded: !card.quoteExpanded }));
    }
    moveTo(x, y) {
        this.patchCard(card => ({ ...card, position: { x, y } }));
    }
    newThread() {
        if (this.snap.card === null)
            return;
        this.clearAuto();
        this.stop(true);
        this.patchCard(card => ({
            ...card,
            phase: 'input',
            messages: [],
            draft: '',
            meta: null,
            threadId: newId(),
            position: card.position,
            lastQuestion: '',
        }));
    }
    retry() {
        const card = this.snap.card;
        if (card === null || card.phase === 'streaming')
            return;
        this.clearAuto();
        const question = card.lastQuestion;
        this.stop(true);
        this.patchCard(current => ({
            ...current,
            phase: 'input',
            messages: [],
            draft: question,
            meta: null,
            threadId: newId(),
            lastQuestion: '',
        }));
        this.send();
    }
    async send() {
        this.clearAuto();
        const card = this.snap.card;
        if (card === null || card.phase === 'streaming')
            return;
        const config = this.snap.config ?? DEFAULTS;
        const draft = card.draft.trim();
        const first = card.messages.length === 0;
        if (draft === '' && (!first || card.mode === 'quick'))
            return;
        const question = draft;
        const userText = draft === ''
            ? (card.mode === 'selection'
                ? (card.filePath !== undefined
                    ? (card.filePath.split(/[\\/]/).pop() ?? '这个文件')
                    : ((0, selection_1.selectionShape)(card.quote) === 'english-prose'
                        ? '翻译这段'
                        : ((0, selection_1.selectionShape)(card.quote) === 'question' ? '回答这段' : '解释这段')))
                : '')
            : draft;
        if (userText === '')
            return;
        const assistantId = newId();
        this.pendingTurnId = assistantId;
        this.pending = '';
        this.patchCard(current => ({
            ...current,
            phase: 'streaming',
            draft: '',
            meta: null,
            lastQuestion: question,
            messages: [
                ...current.messages,
                turn('user', userText),
                turn('assistant', '', { streaming: true, id: assistantId }),
            ],
        }));
        const generation = ++this.generation;
        this.activeGeneration = generation;
        const controller = new AbortController();
        this.abort = controller;
        this.abortReason = null;
        const preferred = this.preferredRoute();
        const body = {
            threadId: card.threadId,
            mode: card.mode,
            question,
            ...(card.mode === 'selection' && first ? { selection: card.quote } : {}),
            ...(first && card.filePath !== undefined ? { filePath: card.filePath } : {}),
            // One explicit route per request: the window's default model. That is
            // the main chat's model unless the plugin row pinned another selectable
            // one. A rendered catalog that does not list the pinned route means the
            // model is gone, so fall back to the main chat instead of failing.
            ...(preferred === null ? {} : { provider: preferred.provider, model: preferred.model }),
            ...(this.snap.bridge?.sessionId === undefined
                ? (this.snap.sessionId === null ? {} : { sessionId: this.snap.sessionId })
                : { sessionId: this.snap.bridge.sessionId }),
            ...(card.sessionId === undefined ? {} : { sessionId: card.sessionId }),
            inheritContext: card.inheritContext,
        };
        try {
            const response = await fetch('/explainer/ask', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!response.ok) {
                let code = `http-${response.status}`;
                let message = `request failed (${response.status})`;
                try {
                    const data = await response.json();
                    if (typeof data?.error?.code === 'string')
                        code = data.error.code;
                    if (typeof data?.error?.message === 'string')
                        message = data.error.message;
                }
                catch {
                    // keep the HTTP fallback
                }
                throw new StreamError(code, message);
            }
            if (response.body === null)
                throw new StreamError('no-body', 'the server returned no stream');
            await this.readStream(response.body, controller.signal);
            if (generation !== this.generation)
                return;
            this.flushPending();
            this.finishStreaming();
        }
        catch (error) {
            if (generation !== this.generation)
                return;
            this.flushPending();
            const aborted = controller.signal.aborted;
            if (aborted && this.abortReason === 'user') {
                this.finishStreaming();
                return;
            }
            const message = aborted
                ? '回答超时，请重试'
                : error instanceof Error ? error.message : String(error);
            this.failStreaming(message, error instanceof StreamError ? error.code : 'internal');
        }
        finally {
            if (this.abort === controller)
                this.abort = null;
        }
    }
    /** Stop the in-flight answer, keeping whatever text already arrived. */
    stop(silent = false) {
        if (!silent) {
            this.flushPending();
            this.finishStreaming();
        }
        if (this.abort !== null) {
            this.abortReason = 'user';
            this.abort.abort();
            this.abort = null;
        }
        // Invalidate the in-flight send: its late deltas must not land in a
        // thread the user already replaced or closed.
        this.generation += 1;
    }
    /**
     * The route every ask should use, in display order of confidence:
     *   1. the pinned `defaultModel`, when the main chat still offers it;
     *   2. the main window's live selection (the product rule);
     *   3. the host-resolved default route (session header → deployment default).
     */
    preferredRoute() {
        const config = this.snap.config;
        const pinned = config?.defaultModel ?? null;
        if (pinned !== null && (config === null || listedRoute(config, pinned)))
            return pinned;
        if (this.snap.sessionModel !== null)
            return this.snap.sessionModel;
        return this.snap.defaultRoute;
    }
    /**
     * The route the window actually answers with, mirroring the host's order:
     * the pinned model while the catalog still lists it (it is the window's
     * default), otherwise whatever the main chat is on. An explicit per-request
     * route can still differ — the window is a default, not a lock.
     */
    effectiveRoute() {
        const config = this.snap.config;
        const pinned = config?.defaultModel ?? null;
        if (pinned !== null && (config === null || listedRoute(config, pinned)))
            return pinned;
        return this.snap.sessionModel ?? this.snap.defaultRoute ?? pinned;
    }
    /** True when the window is pinned to a model instead of following the main chat. */
    isPinnedModel() {
        const config = this.snap.config;
        if ((config?.pinnedModel ?? null) !== null)
            return true;
        const pinned = config?.defaultModel ?? null;
        return pinned !== null && (config === null || listedRoute(config, pinned));
    }
    /* -------------------------------------------------------------- transport */
    async readStream(body, signal) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                if (signal.aborted)
                    return;
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                let index = buffer.indexOf('\n\n');
                while (index >= 0) {
                    this.handleFrame(buffer.slice(0, index));
                    buffer = buffer.slice(index + 2);
                    index = buffer.indexOf('\n\n');
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    handleFrame(frame) {
        if (this.activeGeneration !== this.generation)
            return;
        let event = 'message';
        const data = [];
        for (const line of frame.split('\n')) {
            if (line.startsWith('event:'))
                event = line.slice(6).trim();
            else if (line.startsWith('data:'))
                data.push(line.slice(5).trim());
        }
        if (data.length === 0)
            return;
        let payload;
        try {
            payload = JSON.parse(data.join('\n'));
        }
        catch {
            return;
        }
        if (event === 'delta') {
            const text = typeof payload.text === 'string' ? payload.text : '';
            if (text !== '') {
                this.pending += text;
                this.scheduleFlush();
            }
            return;
        }
        if (event === 'meta') {
            this.patchCard(card => ({
                ...card,
                meta: {
                    provider: typeof payload.provider === 'string' ? payload.provider : undefined,
                    model: typeof payload.model === 'string' ? payload.model : undefined,
                    effort: typeof payload.effort === 'string' ? payload.effort : undefined,
                    contextChars: typeof payload.contextChars === 'number' ? payload.contextChars : undefined,
                },
            }));
            return;
        }
        if (event === 'error') {
            const message = typeof payload.message === 'string' ? payload.message : '生成失败';
            throw new StreamError(typeof payload.code === 'string' ? payload.code : 'error', message);
        }
        if (event === 'done') {
            const ms = typeof payload.ms === 'number' ? payload.ms : undefined;
            this.patchCard(card => ({
                ...card,
                meta: {
                    ...card.meta,
                    ...(ms === undefined ? {} : { ms }),
                },
            }));
        }
    }
    scheduleFlush() {
        if (this.raf !== 0)
            return;
        this.raf = requestAnimationFrame(() => {
            this.raf = 0;
            this.flushPending();
        });
    }
    flushPending() {
        if (this.raf !== 0) {
            cancelAnimationFrame(this.raf);
            this.raf = 0;
        }
        const text = this.pending;
        this.pending = '';
        if (text === '')
            return;
        const id = this.pendingTurnId;
        this.patchCard(card => ({
            ...card,
            messages: card.messages.map(item => (item.id === id ? { ...item, text: item.text + text } : item)),
        }));
    }
    finishStreaming() {
        const id = this.pendingTurnId;
        this.patchCard(card => ({
            ...card,
            phase: 'answer',
            messages: card.messages.map(item => (item.id === id ? { ...item, streaming: false } : item)),
        }));
    }
    failStreaming(message, code) {
        const id = this.pendingTurnId;
        this.patchCard(card => ({
            ...card,
            phase: 'answer',
            messages: card.messages.map(item => (item.id === id
                ? { ...item, streaming: false, error: message, errorCode: code, text: item.text === '' ? '' : item.text }
                : item)),
        }));
    }
    /* ----------------------------------------------------------------- config */
    ensureConfig() {
        if (this.configTask !== null)
            return this.configTask;
        this.configTask = (async () => {
            try {
                const response = await fetch('/explainer/config', { method: 'GET' });
                if (!response.ok)
                    throw new Error(`config ${response.status}`);
                const data = await response.json();
                const config = data?.config;
                if (config !== undefined && typeof config === 'object') {
                    this.emit({ config, defaultRoute: this.routeOf(config.defaultModel), ready: true });
                    return;
                }
                throw new Error('malformed config');
            }
            catch {
                this.emit({ ready: true });
            }
        })();
        return this.configTask;
    }
    routeOf(value) {
        if (value === null || value === undefined)
            return null;
        if (typeof value.provider !== 'string' || value.provider === '')
            return null;
        if (typeof value.model !== 'string' || value.model === '')
            return null;
        return { provider: value.provider, model: value.model };
    }
    /* ------------------------------------------------------------------ bridge */
    setBridge(bridge) {
        this.emit({ bridge });
    }
    setSessionId(sessionId) {
        if (this.snap.sessionId !== sessionId)
            this.emit({ sessionId });
    }
    /** Mirror the main window's model so every ask uses the same route. */
    setSessionModel(model) {
        const current = this.snap.sessionModel;
        if (current?.provider === model?.provider && current?.model === model?.model)
            return;
        if (current === null && model === null)
            return;
        this.emit({ sessionModel: model });
    }
    /** Transient one-line feedback (copied, inserted, errors with no anchor). */
    notify(text) {
        this.noticeId += 1;
        const id = this.noticeId;
        this.emit({ notice: { id, text } });
        clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => {
            if (this.snap.notice?.id === id)
                this.emit({ notice: null });
        }, 1800);
    }
    /** Insert one answer into the main composer without submitting it. */
    insertToComposer(text) {
        const bridge = this.snap.bridge;
        if (bridge === null)
            return false;
        if (bridge.insertText(text))
            return true;
        const draft = bridge.getDraft();
        bridge.setDraft(draft === '' ? text : `${draft}\n\n${text}`);
        return true;
    }
    /** Hand the selection plus the question to the main conversation. */
    escalateToSession() {
        const card = this.snap.card;
        const bridge = this.snap.bridge;
        if (card === null || bridge === null)
            return false;
        const answer = [...card.messages].reverse().find(item => item.role === 'assistant' && item.text !== '');
        const parts = [];
        if (card.quote !== '') {
            parts.push(card.quote.split('\n').map(line => `> ${line}`).join('\n'));
        }
        if (card.lastQuestion !== '')
            parts.push(`我的问题：${card.lastQuestion}`);
        if (answer !== undefined)
            parts.push(`（刚才的快问只给了简答，请深入解释，必要时查代码。）`);
        bridge.setDraft(parts.join('\n\n'));
        return true;
    }
}
exports.ExplainerStore = ExplainerStore;

};
__defs["styles"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STYLES = void 0;
/**
 * One stylesheet for the whole surface.
 *
 * It is injected once by `apply` and removed with the plugin fiber, so the
 * bundle needs no CSS loader and no global side effects after unload. Colors
 * ride the harness `--dsw-alias-*` variables: light and dark themes, and any
 * future palette change, follow automatically.
 */
exports.STYLES = `
.dx-pill{position:fixed;z-index:1190;pointer-events:auto;display:inline-flex;align-items:center;gap:6px;
  padding:6px 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-base,#1b1e23);color:var(--dsw-alias-label-primary,#e7e9ee);
  font-size:12.5px;line-height:1;cursor:pointer;user-select:none;
  box-shadow:0 8px 24px rgba(0,0,0,.35);animation:dx-rise .12s ease-out}
.dx-pill:hover{border-color:var(--dx-accent)}
.dx-pill .dx-spark{color:var(--dx-accent);font-size:13px}

.dx-card{--dx-accent:var(--dsw-alias-state-business-primary,#4a86ff);--dx-border:var(--dsw-alias-border-l2,rgba(255,255,255,.14));
  --dx-soft:var(--dsw-alias-bg-l2,rgba(255,255,255,.045));--dx-muted:var(--dsw-alias-label-secondary,#a3abb8);
  position:fixed;z-index:1200;pointer-events:auto;display:flex;flex-direction:column;
  width:min(440px,calc(100vw - 24px));overflow:hidden;font-size:13px;line-height:1.6;
  border:1px solid var(--dx-border);border-radius:12px;color:var(--dsw-alias-label-primary,#e7e9ee);
  background:var(--dsw-alias-bg-base,#1b1e23);box-shadow:0 18px 50px rgba(0,0,0,.45);
  animation:dx-pop .14s ease-out;outline:none}
.dx-card[data-dragging="true"]{user-select:none}
.dx-head{display:flex;align-items:center;gap:7px;padding:9px 10px 8px 12px;cursor:grab;
  border-bottom:1px solid var(--dx-border);flex:none}
.dx-head:active{cursor:grabbing}
.dx-title{font-size:12.5px;font-weight:600;letter-spacing:.01em;display:inline-flex;align-items:center;gap:6px}
.dx-title .dx-spark{color:var(--dx-accent)}
.dx-badge{font-size:11px;line-height:1;padding:3px 7px;border-radius:999px;border:1px solid var(--dx-border);
  color:var(--dx-muted);background:transparent}
.dx-badge[data-on="true"]{color:var(--dx-accent);border-color:var(--dx-accent);background:rgba(74,134,255,.1)}
button.dx-badge{cursor:pointer}
.dx-head .dx-grow{flex:1}
.dx-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;
  border:0;border-radius:6px;background:transparent;color:var(--dx-muted);cursor:pointer;font-size:13px;line-height:1}
.dx-icon:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff)}
.dx-icon[disabled]{opacity:.35;cursor:default}

.dx-quote{margin:8px 12px 0;padding:7px 10px;border-left:2px solid var(--dx-accent);border-radius:0 7px 7px 0;
  background:rgba(74,134,255,.1);color:var(--dx-muted);font-size:12px;line-height:1.55;white-space:pre-wrap;
  overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dx-quote[data-expanded="true"]{display:block;max-height:150px;overflow:auto;-webkit-line-clamp:unset}
.dx-link{font:inherit;font-size:11px;border:0;background:transparent;color:var(--dx-muted);cursor:pointer;padding:0}
.dx-link:hover{color:var(--dx-accent)}

.dx-body{flex:1;min-height:0;overflow-y:auto;padding:10px 12px 4px;overscroll-behavior:contain}
.dx-turn{display:flex;flex-direction:column;margin-bottom:10px}
.dx-turn[data-role="user"]{align-items:flex-end}
.dx-bubble{max-width:100%;border-radius:9px;padding:7px 10px;overflow-wrap:anywhere}
.dx-turn[data-role="user"] .dx-bubble{max-width:88%;background:var(--dx-soft);color:var(--dsw-alias-label-primary,#e7e9ee)}
.dx-turn[data-role="assistant"] .dx-bubble{background:transparent;padding:0 2px}
.dx-turn[data-role="assistant"] .dx-bubble[data-error="true"]{color:var(--dsw-alias-state-error-primary,#f85149);font-size:12.5px}
.dx-cursor{display:inline-block;width:6px;height:13px;margin-left:2px;vertical-align:-2px;border-radius:1px;
  background:var(--dx-accent);animation:dx-blink 1s steps(1) infinite}
.dx-turn-actions{display:flex;gap:4px;margin-top:6px;opacity:0;transition:opacity .12s}
.dx-turn:hover .dx-turn-actions,.dx-turn[data-active="true"] .dx-turn-actions{opacity:1}
.dx-mini{font:inherit;font-size:11px;line-height:1;padding:4px 7px;border-radius:6px;cursor:pointer;
  border:1px solid var(--dx-border);background:transparent;color:var(--dx-muted)}
.dx-mini:hover{color:var(--dsw-alias-label-primary,#fff);border-color:var(--dx-accent)}
.dx-mini[disabled]{opacity:.35;cursor:default}

.dx-presets{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0}
.dx-chip{font:inherit;font-size:12px;padding:4px 9px;border-radius:999px;cursor:pointer;
  border:1px solid var(--dx-border);background:transparent;color:var(--dx-muted)}
.dx-chip:hover{border-color:var(--dx-accent);color:var(--dsw-alias-label-primary,#fff);background:rgba(74,134,255,.1)}

.dx-compose{flex:none;border-top:1px solid var(--dx-border);padding:8px 10px 8px 12px;display:flex;align-items:flex-end;gap:8px}
.dx-input{flex:1;min-height:36px;max-height:132px;resize:none;border:0;outline:none;background:transparent;
  color:var(--dsw-alias-label-primary,#e7e9ee);font:inherit;font-size:13px;line-height:1.55;padding:6px 0}
.dx-input::placeholder{color:var(--dx-muted);opacity:.8}
.dx-send{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid var(--dx-accent);background:var(--dx-accent);
  color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;transition:filter .12s}
.dx-send:hover{filter:brightness(1.08)}
.dx-send[disabled]{opacity:.4;cursor:default;filter:none}
.dx-send[data-mode="stop"]{background:transparent;color:var(--dsw-alias-state-error-primary,#f85149);border-color:var(--dsw-alias-state-error-primary,#f85149)}

.dx-meta{flex:none;display:flex;gap:8px;align-items:center;padding:0 12px 8px;font-size:10.5px;color:var(--dx-muted)}
.dx-meta .dx-dot{opacity:.5}


.dx-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1300;pointer-events:none;
  padding:7px 13px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-base,#1b1e23);color:var(--dsw-alias-label-primary,#e7e9ee);font-size:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.35);animation:dx-rise .14s ease-out}

.dx-md{font-size:13px;line-height:1.68}
.dx-md p{margin:0 0 7px}.dx-md p:last-child{margin-bottom:0}
.dx-md strong{font-weight:600;color:var(--dsw-alias-label-primary,#fff)}
.dx-md em{font-style:italic}
.dx-md ul,.dx-md ol{margin:4px 0 8px;padding-left:18px}
.dx-md li{margin:2px 0}
.dx-md code{font-family:var(--dx-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;
  background:var(--dx-soft);padding:1px 5px;border-radius:4px}
.dx-md pre{margin:7px 0;padding:8px 10px;border-radius:8px;border:1px solid var(--dx-border);background:var(--dx-soft);
  overflow:auto;font-family:var(--dx-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;line-height:1.55}
.dx-md pre code{background:none;padding:0;font-size:inherit}
.dx-md h1,.dx-md h2,.dx-md h3{font-size:13px;margin:8px 0 5px;font-weight:600}
.dx-md blockquote{margin:6px 0;padding-left:9px;border-left:2px solid var(--dx-border);color:var(--dx-muted)}
.dx-md a{color:var(--dx-accent);text-decoration:none}
.dx-md a:hover{text-decoration:underline}

.dx-model,.dx-file{max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.75}
.dx-file-ask{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:11px;line-height:1;
  padding:3px 8px;border-radius:6px;cursor:pointer;white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));background:transparent;
  color:var(--dsw-alias-label-secondary,#a3abb8)}
.dx-file-ask:hover{border-color:var(--dsw-alias-state-business-primary,#4a86ff);color:var(--dsw-alias-label-primary,#e7e9ee);background:rgba(74,134,255,.1)}
.dx-file-ask>span{color:var(--dsw-alias-state-business-primary,#4a86ff)}

.dx-launcher{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;line-height:1;
  padding:5px 9px;border-radius:7px;cursor:pointer;border:1px solid transparent;background:transparent;
  color:var(--dsw-alias-label-secondary,#a3abb8)}
.dx-launcher:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#fff)}
.dx-launcher .dx-spark{color:var(--dx-accent)}

.dx-html-adapter,.dx-html-preview{display:flex;flex-direction:column;flex:1;min-height:0;height:100%}.dx-html-preview iframe{flex:1;width:100%;min-height:300px;border:0;background:white}.dx-html-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 10px;font-size:11px;border-bottom:1px solid var(--dsw-alias-border-l2,#444)}.dx-html-bar button,.dx-html-start button{cursor:pointer;padding:5px 10px}.dx-html-start{padding:14px;font-size:13px}
.dx-html-frame{display:block;width:100%;height:100%;min-height:240px;border:0;background:#fff;flex:1 1 auto;align-self:stretch}
.dx-html-error{padding:12px;font-size:12px;color:var(--dsw-alias-state-error-primary,#e5484d)}
@keyframes dx-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes dx-pop{from{opacity:0;transform:translateY(5px) scale(.99)}to{opacity:1;transform:none}}
@keyframes dx-blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .dx-pill,.dx-card,.dx-toast{animation:none}
  .dx-cursor{animation:none}
  .dx-turn-actions{transition:none}
}
`;

};
__defs["types"] = function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

};
__defs["use-store"] = function (module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStore = useStore;
const React = __importStar(require("react"));
/**
 * Subscribe a component to a stable slice of the store.
 *
 * `getSnapshot` must return a stable value between emits; the store replaces
 * the snapshot object only when something actually changed, and every selector
 * here returns either a primitive or a slice that keeps its identity.
 */
function useStore(store, select) {
    const read = React.useCallback(() => select(store.getSnapshot()), [store, select]);
    return React.useSyncExternalStore(store.subscribe, read, read);
}

};
module.exports = __load("index");
return module.exports;
} });
