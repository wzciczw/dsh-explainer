import * as React from 'react'
import type { ExplainerStore } from './store'

/** The slice of `inputActions` the bridge uses. */
interface InputActionsLike {
  captureInsertion: () => unknown
  insertText: (text: string, span: unknown) => boolean
  setDraft: (text: string) => void
}

/**
 * The composer seat is headless: it publishes the current session's composer
 * actions so the floating window can insert text or hand a question back to the
 * main conversation, and it mirrors the main window's durable model selection.
 *
 * There is deliberately no launcher button in the input bar. The quick-ask
 * window opens from a selection (pill / right-click), from the document
 * toolbar, or with `Ctrl/Cmd+Shift+K`.
 */
export function ComposerBridge(props: {
  store: ExplainerStore
  sessionId: string
  inputActions: InputActionsLike
  useInput: (select: (state: { draft: string }) => string) => string
  useProjection: (
    key: string,
    select: (value: { next?: { provider?: string; model?: string } } | undefined) => unknown,
  ) => unknown
}): null {
  const { store, sessionId, inputActions } = props
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

  return null
}
