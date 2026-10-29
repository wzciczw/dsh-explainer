import * as React from 'react'
import type { ExplainerStore } from './store'
import type { Translate } from './overlay'

/**
 * The document preview's toolbar contribution.
 *
 * It publishes the previewed file's absolute path as a hidden marker (the
 * selection detector reads it back from the preview root), and offers an
 * explicit "Ask" action. The action matters for HTML previews: they render in
 * an opaque sandboxed iframe whose selection the parent page cannot read, so
 * the toolbar is the only way in there — the host still reads the whole file.
 */
export function FileMarker(props: {
  store: ExplainerStore
  t: Translate
  absolutePath: string
}): React.ReactElement | null {
  const { store, t, absolutePath } = props
  if (typeof absolutePath !== 'string' || absolutePath.trim() === '') return null
  return (
    <>
      <span hidden data-explainer-file-path={absolutePath} />
      <button
        type="button"
        className="dx-file-ask"
        title={t('askFile')}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          store.openSelection(rect, '', absolutePath)
        }}
      >
        <span aria-hidden="true">✦</span>
        {t('askFile')}
      </button>
    </>
  )
}