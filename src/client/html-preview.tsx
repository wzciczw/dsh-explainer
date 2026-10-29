import * as React from 'react'
import type { ExplainerStore } from './store'
import { bindHtmlBridge } from './html-receiver'
import { buildBridgeDocument, previewIdentity } from './html-bridge'

/**
 * The default HTML renderer: the file's own document inside an opaque frame,
 * plus a selection bridge. Scripts, inline styles and data images render as
 * authored; the frame has no same-origin, so the page never reaches the app.
 */
export function HtmlSelectionPreview(props: {
  source: string
  path: string
  sessionId?: string
  store: ExplainerStore
}): React.ReactElement {
  const { source, path, sessionId, store } = props
  const frame = React.useRef<HTMLIFrameElement>(null)
  const prepared = React.useMemo<{ channel: string; html: string } | { error: string }>(() => {
    try {
      const channel = previewIdentity()
      return { channel, html: buildBridgeDocument(source, channel) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [source])
  const url = React.useMemo(() => {
    if (!('html' in prepared)) return null
    return URL.createObjectURL(new Blob([prepared.html], { type: 'text/html' }))
  }, [prepared])
  React.useEffect(() => {
    const element = frame.current
    if (!element || url === null || !('channel' in prepared)) return
    const dispose = bindHtmlBridge(element, prepared.channel, path, {
      hint: value => (value ? store.showHint(value.text, value.rect, path, sessionId) : store.hideHint()),
      open: value => store.openSelection(value.rect, value.text, path, sessionId),
      outside: () => store.close(),
      escape: () => (store.getSnapshot().card?.phase === 'streaming' ? store.stop() : store.close()),
      enabled: () => store.getSnapshot().config?.enabled !== false,
      rightClick: () => store.getSnapshot().config?.rightClick !== false,
    })
    return dispose
  }, [url, prepared, path, sessionId, store])
  React.useEffect(() => () => { if (url !== null) URL.revokeObjectURL(url) }, [url])
  if ('error' in prepared) return <p role="alert" className="dx-html-error">{prepared.error}</p>
  if (url === null) return <p className="dx-html-error">正在准备 HTML 预览…</p>
  return <iframe
    ref={frame}
    className="dx-html-frame"
    src={url}
    sandbox="allow-scripts allow-popups allow-downloads allow-modals"
    referrerPolicy="no-referrer"
    title="HTML 划词预览"
  />
}
