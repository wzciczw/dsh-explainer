import { filePathOf, readSelection, type DetectedSelection } from './selection'
import type { RectLike } from './types'

interface PreviewCallbacks {
  hint: (selection: DetectedSelection | null) => void
  open: (selection: DetectedSelection) => void
  pointerDown: () => void
  enabled: () => boolean
  rightClick: () => boolean
  escape: () => void
}

/** No injection, srcdoc rewrite, sandbox downgrade, or postMessage receiver. */
export function accessiblePreviewDocument(frame: HTMLIFrameElement): Document | null {
  if (!frame.isConnected || filePathOf(frame) === undefined) return null
  const sandbox = frame.getAttribute('sandbox')
  // Explicitly reject opaque frames even in DOM emulators that do not enforce SOP.
  if (sandbox !== null && !sandbox.split(/\s+/).includes('allow-same-origin')) return null
  try {
    const doc = frame.contentDocument
    return doc?.defaultView === null ? null : doc
  } catch {
    return null // Cross-origin navigation is a normal unsupported preview.
  }
}

/** Map iframe viewport coordinates through borders and axis-aligned CSS scaling. */
export function previewRect(frame: HTMLIFrameElement, rect: RectLike): RectLike | null {
  const outer = frame.getBoundingClientRect()
  if (outer.width <= 0 || outer.height <= 0 || frame.offsetWidth <= 0 || frame.offsetHeight <= 0) return null
  const sx = outer.width / frame.offsetWidth
  const sy = outer.height / frame.offsetHeight
  const left = outer.left + (frame.clientLeft + rect.left) * sx
  const top = outer.top + (frame.clientTop + rect.top) * sy
  const right = outer.left + (frame.clientLeft + rect.right) * sx
  const bottom = outer.top + (frame.clientTop + rect.bottom) * sy
  const values = [left, top, right, bottom]
  if (!values.every(Number.isFinite) || right <= left || bottom <= top) return null
  const view = frame.ownerDocument.defaultView
  if (view === null || right <= 0 || bottom <= 0 || left >= view.innerWidth || top >= view.innerHeight
    || right <= outer.left || left >= outer.right || bottom <= outer.top || top >= outer.bottom) return null
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

/**
 * Observe direct, recognized file-preview frames only. Events do not bubble
 * across documents. Each accessible document gets listeners, not injected JS.
 * Reloads, attribute changes, tab removal and disposal revoke old listeners.
 * Child frames are deliberately not traversed: their content is not necessarily
 * the file identified by the outer preview. All paths come from the parent UI.
 */
export function observePreviewFrames(owner: Document, callbacks: PreviewCallbacks): () => void {
  const view = owner.defaultView
  if (view === null) return () => {}
  const frames = new Map<HTMLIFrameElement, { doc: Document | null; path: string | undefined; detach: () => void; load: () => void }>()
  let disposed = false
  let queued = false

  const bind = (frame: HTMLIFrameElement, doc: Document): (() => void) => {
    let timer = 0
    let down = false
    const current = (): DetectedSelection | null => {
      if (!callbacks.enabled() || accessiblePreviewDocument(frame) !== doc) return null
      const path = filePathOf(frame)
      if (path === undefined || doc.defaultView === null) return null
      try {
        const found = readSelection(doc.defaultView, path)
        if (found === null) return null
        const rect = previewRect(frame, found.rect)
        return rect === null ? null : { ...found, rect }
      } catch { return null }
    }
    const compute = (): void => callbacks.hint(current())
    const schedule = (delay: number): void => {
      view.clearTimeout(timer)
      timer = view.setTimeout(compute, delay)
    }
    const onDown = (): void => { down = true; view.clearTimeout(timer); callbacks.pointerDown() }
    const onUp = (): void => { down = false; schedule(16) }
    const onChange = (): void => { if (!down) schedule(160) }
    const onScroll = (): void => { view.clearTimeout(timer); callbacks.hint(null) }
    const onContext = (event: MouseEvent): void => {
      if (!callbacks.rightClick()) return
      const found = current()
      if (found === null) return
      event.preventDefault()
      view.clearTimeout(timer)
      callbacks.open(found)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (!callbacks.enabled()) return
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
        const found = current()
        if (found !== null) { event.preventDefault(); callbacks.open(found) }
      } else if (event.key === 'Escape') callbacks.escape()
    }
    doc.addEventListener('pointerdown', onDown, true)
    doc.addEventListener('pointerup', onUp, true)
    doc.addEventListener('selectionchange', onChange)
    doc.addEventListener('scroll', onScroll, true)
    doc.addEventListener('contextmenu', onContext, true)
    doc.addEventListener('keydown', onKey, true)
    return () => {
      view.clearTimeout(timer)
      doc.removeEventListener('pointerdown', onDown, true)
      doc.removeEventListener('pointerup', onUp, true)
      doc.removeEventListener('selectionchange', onChange)
      doc.removeEventListener('scroll', onScroll, true)
      doc.removeEventListener('contextmenu', onContext, true)
      doc.removeEventListener('keydown', onKey, true)
    }
  }
  const refresh = (frame: HTMLIFrameElement): void => {
    const state = frames.get(frame)
    if (state === undefined) return
    const doc = accessiblePreviewDocument(frame)
    const path = filePathOf(frame)
    if (doc === state.doc && path === state.path) return
    state.detach()
    callbacks.hint(null)
    state.doc = doc
    state.path = path
    state.detach = doc === null ? () => {} : bind(frame, doc)
  }
  const scan = (): void => {
    queued = false
    if (disposed) return
    for (const [frame, state] of frames) {
      if (!frame.isConnected || filePathOf(frame) === undefined) {
        state.detach()
        frame.removeEventListener('load', state.load)
        frames.delete(frame)
        callbacks.hint(null)
      }
    }
    for (const frame of owner.querySelectorAll('iframe')) {
      if (filePathOf(frame) === undefined) continue
      if (!frames.has(frame)) {
        const load = (): void => refresh(frame)
        frames.set(frame, { doc: null, path: undefined, detach: () => {}, load })
        frame.addEventListener('load', load)
      }
      refresh(frame)
    }
  }
  const observer = new MutationObserver(() => {
    if (!queued && !disposed) { queued = true; queueMicrotask(scan) }
  })
  observer.observe(owner.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['sandbox', 'src', 'srcdoc', 'data-explainer-file-path', 'data-textpreview-body',
      'data-textpreview-state', 'data-dsh-pane', 'data-dsh-native-tab-host', 'title'],
  })
  scan()
  const onResize = (): void => { callbacks.hint(null); scan() }
  view.addEventListener('resize', onResize)
  return () => {
    disposed = true
    observer.disconnect()
    view.removeEventListener('resize', onResize)
    for (const [frame, state] of frames) {
      state.detach()
      frame.removeEventListener('load', state.load)
    }
    frames.clear()
  }
}
