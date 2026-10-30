import * as React from 'react'
import type { ExplainerStore } from './store'
import { HtmlSelectionPreview } from './html-preview'

interface PreviewContext {
  inject?: (names: string[], fn: (ctx: PreviewContext) => void) => unknown
  effect: (fn: () => unknown, label?: string) => unknown
  get?: (name: string) => unknown
  slots: {
    inject(name: string, fn: () => unknown): unknown
    register(options: Record<string, unknown>, render: (props: any) => React.ReactElement): unknown
  }
}

function decode(content: unknown): string {
  if (content === null || typeof content !== 'object') return ''
  const value = content as Record<string, unknown>
  if (value.kind !== 'bytes' || !(value.data instanceof Uint8Array)) return ''
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value.data)
  } catch {
    return ''
  }
}

/**
 * Register the HTML selection renderer as the default HTML implementation.
 *
 * It is an "extension" registration, so the viewer menu still offers the
 * shipped preview: a file whose scripts need the host's resource packing can
 * be switched back, and nothing is removed.
 */
export function installHtmlPreviews(ctx: PreviewContext, store: ExplainerStore, t: (key: string) => string): void {
  // 1. Native document preview (right sidebar).
  ctx.inject?.(['documentPreviews'], scope => {
    const registry = scope.get?.('documentPreviews') as any
    if (!registry?.register) return
    const id = 'dsh-explainer/html'
    scope.effect(() => registry.register({
      id,
      extensions: ['html', 'htm'],
      priority: 'extension',
      title: () => 'HTML（划词）',
      loading: 'bytes-complete',
      wrap: false,
    }), 'explainer: HTML selection renderer')
    scope.slots.inject('sidebar.right.tab.document', () => scope.slots.register({
      name: 'sidebar.right.tab.document',
      key: id,
    }, (props: any) => {
      const resource = props.useResource?.(props.resourceAddress)
      const path = resource?.value?.absolutePath
      const source = decode(props.content)
      if (typeof path !== 'string' || path === '') return <p>正在读取文件路径…</p>
      return <HtmlSelectionPreview key={props.resourceAddress} source={source} path={path}
        sessionId={props.sessionId} store={store} t={t} />
    }))
  })

  // 2. better-sidebar's editor, when that plugin is installed.
  ctx.inject?.(['betterSidebar'], scope => {
    const service = scope.get?.('betterSidebar') as any
    if (!service?.getFileViewers || !service?.registerFileViewer) return
    const original = service.getFileViewers().find((viewer: any) => viewer.id === 'html')
    if (!original) return
    function BetterHtml(props: any): React.ReactElement {
      const source = typeof props.content === 'string' ? props.content : ''
      return <HtmlSelectionPreview key={props.path} source={source} path={props.path}
        sessionId={props.scope?.sessionId ?? props.sessionId} store={store} t={t} />
    }
    scope.effect(() => service.registerFileViewer({
      id: 'explainer-html', title: () => 'HTML（划词）',
      exts: ['html', 'htm'], priority: (original.priority ?? 0) + 1,
      fetchStrategy: 'fsRead', component: BetterHtml,
    }), 'explainer: better-sidebar HTML renderer')
  })
}
