import type { ThreadMessage } from './types.js'

/** One isolated quick-ask conversation, held in host memory only. */
export interface Thread {
  readonly id: string
  createdAt: number
  lastUsed: number
  messages: ThreadMessage[]
  model?: { provider: string; model: string }
  inheritContext: boolean
  /** Selection this thread was opened with, reused for per-turn file grounding. */
  selection: string
  /** The read-only conversation snapshot, reused for per-turn file grounding. */
  contextText: string
  /** Session workspace root, the only tree file grounding may read. */
  cwd?: string
  /** Characters of the read-only main-session snapshot copied into the opening turn. */
  contextChars: number
  turns: number
}

/**
 * Bounded, TTL'd thread table.
 *
 * Quick-ask threads are deliberately never persisted: close the page or let
 * the TTL expire and the isolated conversation is gone, while the main session
 * log never contained it in the first place.
 */
export class ThreadStore {
  private readonly map = new Map<string, Thread>()

  constructor(
    private readonly maxThreads: number,
    private readonly ttlMs: number,
  ) {}

  /** Read a live thread and refresh its LRU position. */
  get(id: string, now: number): Thread | undefined {
    const thread = this.map.get(id)
    if (thread === undefined) return undefined
    if (now - thread.lastUsed > this.ttlMs) {
      this.map.delete(id)
      return undefined
    }
    thread.lastUsed = now
    return thread
  }

  /** Insert a fresh thread, evicting the least recently used beyond the cap. */
  create(thread: Thread): Thread {
    this.map.set(thread.id, thread)
    this.prune(thread.lastUsed)
    return thread
  }

  /** Drop one thread (panel gesture or cancellation of a failed creation). */
  remove(id: string): void {
    this.map.delete(id)
  }

  /** Drop expired threads and enforce the size cap; returns the live count. */
  prune(now: number): number {
    for (const [id, thread] of this.map) {
      if (now - thread.lastUsed > this.ttlMs) this.map.delete(id)
    }
    while (this.map.size > this.maxThreads) {
      let oldestId: string | undefined
      let oldest = Number.POSITIVE_INFINITY
      for (const [id, thread] of this.map) {
        if (thread.lastUsed < oldest) {
          oldest = thread.lastUsed
          oldestId = id
        }
      }
      if (oldestId === undefined) break
      this.map.delete(oldestId)
    }
    return this.map.size
  }

  /** Live thread count, for the config endpoint and diagnostics. */
  size(): number {
    return this.map.size
  }
}