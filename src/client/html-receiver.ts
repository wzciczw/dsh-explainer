import { HTML_BRIDGE } from './html-bridge'
import { previewRect } from './preview-frames'
import type { DetectedSelection } from './selection'

export interface HtmlBridgeCallbacks {
  hint(value: DetectedSelection | null): void
  open(value: DetectedSelection): void
  outside(): void
  escape(): void
  enabled(): boolean
  rightClick(): boolean
}

/** Source, per-document identity, sequence and bounded viewport validation. */
export function bindHtmlBridge(
  frame: HTMLIFrameElement, channel: string, filePath: string, callbacks: HtmlBridgeCallbacks,
): () => void {
  const owner = frame.ownerDocument.defaultView
  if (!owner) return () => {}
  let sequence = 0
  let start = 0
  let count = 0
  let live = true
  const receive = (event: MessageEvent): void => {
    if (!live || !frame.isConnected || !callbacks.enabled() || event.source !== frame.contentWindow) return
    const value: unknown = event.data
    if (value === null || typeof value !== 'object') return
    const msg = value as Record<string, unknown>
    if (msg.type !== HTML_BRIDGE || msg.channel !== channel
      || !Number.isSafeInteger(msg.sequence) || (msg.sequence as number) <= sequence) return
    const now = performance.now()
    if (now - start > 1000) { start = now; count = 0 }
    if (++count > 40) return
    sequence = msg.sequence as number
    if (msg.action === 'clear') { callbacks.hint(null); return }
    if (msg.action === 'outside') { callbacks.outside(); return }
    if (msg.action === 'escape') { callbacks.escape(); return }
    if (msg.action !== 'hint' && msg.action !== 'open') return
    if (typeof msg.text !== 'string' || msg.text.length < 2 || msg.text.length > 6000) return
    if (msg.rect === null || typeof msg.rect !== 'object') return
    const r = msg.rect as Record<string, unknown>
    const keys = ['left', 'top', 'right', 'bottom'] as const
    if (!keys.every(key => typeof r[key] === 'number' && Number.isFinite(r[key]))) return
    const left = r.left as number, top = r.top as number, right = r.right as number, bottom = r.bottom as number
    if (right <= left || bottom <= top || left < -1 || top < -1
      || right > frame.clientWidth + 2 || bottom > frame.clientHeight + 2) return
    const rect = previewRect(frame, { left, top, right, bottom, width: right - left, height: bottom - top })
    if (!rect) return
    const selection: DetectedSelection = { kind: 'file', text: msg.text, rect, filePath }
    if (msg.action === 'open' && callbacks.rightClick()) callbacks.open(selection)
    else callbacks.hint(selection)
  }
  owner.addEventListener('message', receive)
  const clear = (): void => callbacks.hint(null)
  owner.addEventListener('resize', clear)
  owner.addEventListener('scroll', clear, true)
  return () => {
    live = false
    owner.removeEventListener('message', receive)
    owner.removeEventListener('resize', clear)
    owner.removeEventListener('scroll', clear, true)
    callbacks.hint(null)
  }
}
