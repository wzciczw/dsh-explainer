import * as React from 'react'

/**
 * A hidden marker published into the document preview's toolbar.
 *
 * The preview body and its toolbar live in the same preview root, so a
 * selection inside the body can find its file's absolute path by looking up
 * this marker within that root. It renders nothing visible.
 */
export function FileMarker(props: { absolutePath: string }): React.ReactElement | null {
  if (typeof props.absolutePath !== 'string' || props.absolutePath.trim() === '') return null
  return <span hidden data-explainer-file-path={props.absolutePath} />
}