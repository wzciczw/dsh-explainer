/**
 * Bounded, TTL'd thread table.
 *
 * Quick-ask threads are deliberately never persisted: close the page or let
 * the TTL expire and the isolated conversation is gone, while the main session
 * log never contained it in the first place.
 */
export class ThreadStore {
    maxThreads;
    ttlMs;
    map = new Map();
    constructor(maxThreads, ttlMs) {
        this.maxThreads = maxThreads;
        this.ttlMs = ttlMs;
    }
    /** Read a live thread and refresh its LRU position. */
    get(id, now) {
        const thread = this.map.get(id);
        if (thread === undefined)
            return undefined;
        if (now - thread.lastUsed > this.ttlMs) {
            this.map.delete(id);
            return undefined;
        }
        thread.lastUsed = now;
        return thread;
    }
    /** Insert a fresh thread, evicting the least recently used beyond the cap. */
    create(thread) {
        this.map.set(thread.id, thread);
        this.prune(thread.lastUsed);
        return thread;
    }
    /** Drop one thread (panel gesture or cancellation of a failed creation). */
    remove(id) {
        this.map.delete(id);
    }
    /** Drop expired threads and enforce the size cap; returns the live count. */
    prune(now) {
        for (const [id, thread] of this.map) {
            if (now - thread.lastUsed > this.ttlMs)
                this.map.delete(id);
        }
        while (this.map.size > this.maxThreads) {
            let oldestId;
            let oldest = Number.POSITIVE_INFINITY;
            for (const [id, thread] of this.map) {
                if (thread.lastUsed < oldest) {
                    oldest = thread.lastUsed;
                    oldestId = id;
                }
            }
            if (oldestId === undefined)
                break;
            this.map.delete(oldestId);
        }
        return this.map.size;
    }
    /** Live thread count, for the config endpoint and diagnostics. */
    size() {
        return this.map.size;
    }
}
