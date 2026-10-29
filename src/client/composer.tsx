import * as React from 'react'
import type { ExplainerStore } from './store'
import { findComposerRect } from './selection'
import { useStore } from './use-store'
import type { Translate } from './overlay'

/** The slice of `inputActions` the bridge uses. */
interface InputActionsLike {
  captureInsertion: () => unknown
  insertText: (text: string, span: unknown) => boolean
  setDraft: (text: string) => void
}

/**
 * The composer entry does two jobs: it is the discoverable 快问 launcher, and
 * it publishes the current session's composer actions so the floating window
 * can insert text or hand a question back to the main conversation.
 */
export function ComposerButton(props: {
  store: ExplainerStore
  t: Translate
  sessionId: string
  inputActions: InputActionsLike
  useInput: (select: (state: { draft: string }) => string) => string
  useProjection: (
    key: string,
    select: (value: { next?: { provider?: string; model?: string } } | undefined) => unknown,
  ) => unknown
}): React.ReactElement | null {
  const { store, t, sessionId, inputActions } = props
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)
  const enabled = useStore(store, snapshot => snapshot.config?.enabled !== false)
  const draft = props.useInput(state => state.draft)
  const draftRef = React.useRef(draft)
  draftRef.current = draft

  // Mirror the main window's durable model selection: the ask window must use
  // the exact same provider/model, and follow a switch made in the main UI.
  const selection = props.useProjection('modelSelection', value => value?.next) as
    | { provider?: string; model?: string }
    | null
    | undefined
  const selectedProvider = selection?.provider
  const selectedModel = selection?.model

  React.useEffect(() => {
    store.setSessionModel(
      typeof selectedProvider === 'string' && typeof selectedModel === 'string'
        ? { provider: selectedProvider, model: selectedModel }
        : null,
    )
  }, [store, selectedProvider, selectedModel])

  React.useEffect(() => {
    store.setBridge({
      sessionId,
      getDraft: () => draftRef.current,
      insertText: text => {
        try {
          return inputActions.insertText(text, inputActions.captureInsertion())
        } catch {
          return false
        }
      },
      setDraft: text => inputActions.setDraft(text),
    })
    return () => { store.setBridge(null) }
  }, [store, sessionId, inputActions])

  const open = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    // The launcher doubles as the window toggle: open, or close when already open.
    if (store.getSnapshot().card !== null) {
      store.close()
      return
    }
    const anchor = findComposerRect() ?? buttonRef.current?.getBoundingClientRect()
    if (anchor === undefined) return
    store.openQuick({
      left: anchor.left,
      top: anchor.top,
      right: anchor.right,
      bottom: anchor.bottom,
      width: anchor.width,
      height: anchor.height,
    })
  }

  if (!enabled) return null

  return (
    <button
      ref={buttonRef}
      type="button"
      className="dx-launcher"
      title={`${t('quickAsk')} (Ctrl+Shift+K)`}
      aria-label={t('quickAsk')}
      onClick={open}
    >
      <span className="dx-spark">✦</span>
      {t('quickAsk')}
    </button>
  )
}