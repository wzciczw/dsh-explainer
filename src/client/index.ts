import * as React from 'react'
import { ExplainerStore } from './store'
import { Overlay } from './overlay'
import { ComposerButton } from './composer'
import { FileMarker } from './file-marker'
import { STRINGS } from './locales'
import { STYLES } from './styles'

export { inject, name } from './meta'

type SlotProps = Record<string, unknown>

/** Structural view of the browser-side Cordis context we consume. */
interface ClientContext {
  slots: {
    inject: (key: string, register: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: (props: SlotProps) => React.ReactElement) => unknown
  }
  locale: {
    register: (namespace: string, dictionaries: unknown) => unknown
    bind: (namespace: string) => (key: string) => string
  }
  effect: (fn: () => unknown, label?: string) => unknown
  get?: (key: string) => unknown
}

/**
 * Browser half of 快问.
 *
 * Two additive seats: a frame-wide floating layer for the selection pill and
 * the quick-ask window, and a composer entry for the launcher plus the
 * session-scoped bridge. Both share one store created here, closed over by the
 * components, and disposed with the plugin fiber.
 */
export function apply(ctx: ClientContext): void {
  const store = new ExplainerStore()

  ctx.effect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-dsh-explainer', '')
    style.textContent = STYLES
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'explainer: styles')

  ctx.effect(() => ctx.locale.register('explainer', STRINGS), 'explainer: dictionaries')
  const t = ctx.locale.bind('explainer')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'explainer.window', order: 520 },
    (props: SlotProps) => React.createElement(Overlay, {
      store,
      t,
      useSessions: props['useSessions'] as never,
    }),
  ))

  // The right sidebar's document preview gets a hidden marker carrying the
  // previewed file's absolute path; selection detection reads it back.
  ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register(
    { name: 'sidebar.right.tab.document.actions', id: 'explainer.file-context', order: 500 },
    (props: SlotProps) => React.createElement(FileMarker, {
      absolutePath: props['absolutePath'] as string,
    }),
  ))

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
    { name: 'conversation.input.right', id: 'explainer.quick', order: 260, label: () => t('quickAsk') },
    (props: SlotProps) => React.createElement(ComposerButton, {
      store,
      t,
      sessionId: props['sessionId'] as string,
      inputActions: props['inputActions'] as never,
      useInput: props['useInput'] as never,
      useProjection: props['useProjection'] as never,
    }),
  ))
}