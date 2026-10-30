/** The bridge document: the file's own HTML, plus one selection-reporting script. */

export const HTML_BRIDGE = 'dsh-explainer/html-selection/v1'
/** A rendered report is a working document, not an attachment; 8 MB is plenty. */
export const MAX_HTML_CHARS = 8_000_000

/**
 * The script that runs inside the opaque preview frame. It only reads the
 * current selection and reports it to the parent; it has no file, model or
 * parent-DOM access, and it never sends anything the page did not select.
 */
export function childBridge(channel: string): void {
  let sequence = 0
  let timer = 0
  let selectionMode = false
  const send = (action: string, payload: Record<string, unknown> = {}): void => {
    parent.postMessage({ type: 'dsh-explainer/html-selection/v1', channel, sequence: ++sequence, action, ...payload }, '*')
  }
  const selected = (): Record<string, unknown> | null => {
    const selection = window.getSelection()
    if (selection === null || selection.isCollapsed || selection.rangeCount !== 1) return null
    const range = selection.getRangeAt(0)
    const node = range.commonAncestorContainer
    const element = node.nodeType === 1 ? node as Element : node.parentElement
    if (element === null || element.closest('input,textarea,select,[contenteditable]')) return null
    const text = selection.toString().trim().slice(0, 6000)
    if (text.length < 2) return null
    const rects = range.getClientRects()
    const rect = rects[rects.length - 1] ?? range.getBoundingClientRect()
    return { text, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } }
  }
  const report = (): void => {
    const value = selected()
    send(value ? 'hint' : 'clear', value ?? {})
  }
  const applyMode = (enabled: boolean): void => {
    selectionMode = enabled
    if (enabled) document.documentElement.setAttribute('data-explainer-selection-mode', '')
    else document.documentElement.removeAttribute('data-explainer-selection-mode')
    const id = 'dsh-explainer-selection-mode-style'
    const existing = document.getElementById(id)
    if (enabled && existing === null) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = 'html[data-explainer-selection-mode] svg,html[data-explainer-selection-mode] svg text,html[data-explainer-selection-mode] .diagram-container{cursor:text!important;user-select:text!important}'
      document.head.append(style)
    } else if (!enabled && existing !== null) {
      existing.remove()
    }
  }
  window.addEventListener('message', event => {
    if (event.source !== parent) return
    const data = event.data as { type?: unknown; enabled?: unknown } | null
    if (data !== null && typeof data === 'object' && data.type === 'dsh-explainer/selection-mode') {
      applyMode(data.enabled === true)
    }
  })
  document.addEventListener('pointerdown', () => send('outside'), true)
  // Interactive diagrams start panning/zooming on pointerdown. In selection
  // mode, or while Alt/Option is held, the event must not reach those
  // handlers so the browser can create a native text selection.
  document.addEventListener('pointerdown', event => {
    if (!selectionMode && !event.altKey) return
    const target = event.target instanceof Element ? event.target : null
    if (target === null) return
    if (target.closest('button, a, input, select, textarea, [role="button"], [contenteditable], .toolbar, .diagram-nav, .reader-rail')) return
    event.stopPropagation()
  }, true)
  document.addEventListener('pointerup', () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(report, 20)
  }, true)
  document.addEventListener('selectionchange', () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(report, 160)
  })
  document.addEventListener('contextmenu', event => {
    const value = selected()
    if (value !== null) {
      event.preventDefault()
      send('open', value)
    }
  }, true)
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') send('escape')
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
      const value = selected()
      if (value !== null) {
        event.preventDefault()
        send('open', value)
      }
    }
  }, true)
  document.addEventListener('scroll', () => send('clear'), true)
}

/** Generate one opaque preview document that keeps the file's own rendering. */
export function buildBridgeDocument(source: string, channel: string): string {
  if (source.length > MAX_HTML_CHARS) throw new Error('HTML 文件超过 8 MB，划词预览暂不支持这么大的文件。')
  if (!/^[a-f0-9]{32,}$/.test(channel)) throw new Error('Invalid preview identity')
  const script = `<script>(${childBridge.toString()})(${JSON.stringify(channel)});</script>`
  // Insert before </body> when there is one so the bridge runs after the page's
  // own scripts; otherwise append (the document still executes top to bottom).
  const close = source.toLowerCase().lastIndexOf('</body>')
  return close === -1 ? source + script : source.slice(0, close) + script + source.slice(close)
}

/** A fresh per-document channel; the parent only accepts messages on it. */
export function previewIdentity(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
}
