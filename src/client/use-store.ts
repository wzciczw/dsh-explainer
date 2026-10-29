import * as React from 'react'
import type { ExplainerStore } from './store'
import type { Snapshot } from './types'

/**
 * Subscribe a component to a stable slice of the store.
 *
 * `getSnapshot` must return a stable value between emits; the store replaces
 * the snapshot object only when something actually changed, and every selector
 * here returns either a primitive or a slice that keeps its identity.
 */
export function useStore<T>(store: ExplainerStore, select: (snapshot: Snapshot) => T): T {
  const read = React.useCallback(() => select(store.getSnapshot()), [store, select])
  return React.useSyncExternalStore(store.subscribe, read, read)
}