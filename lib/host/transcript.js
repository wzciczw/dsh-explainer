const PER_TURN_MAX_CHARS = 2_400;
/** Extract plain text from a message's content blocks. */
function blocksToText(content) {
    if (!Array.isArray(content))
        return '';
    const parts = [];
    for (const block of content) {
        if (block !== null && typeof block === 'object') {
            const item = block;
            if (item.type === 'text' && typeof item.text === 'string' && item.text.trim() !== '') {
                parts.push(item.text);
            }
        }
    }
    return parts.join('\n').trim();
}
function clip(text, max) {
    if (text.length <= max)
        return text;
    // Keep the head of each turn: a user question states its own premise early,
    // and an assistant answer leads with its conclusion.
    return `${text.slice(0, max)}…`;
}
/**
 * Reconstruct the newest conversation turns from the session event log,
 * newest-first so a long history never costs more than the budget we use.
 *
 * This is a READ. The snapshot is copied into the quick-ask thread and the
 * main session is never appended to, which is the whole isolation contract.
 */
export function readTranscript(sessions, sessionId, maxMessages, maxChars) {
    if (sessionId === undefined || sessions === undefined || maxMessages <= 0 || maxChars <= 0) {
        return { text: '', turns: 0, chars: 0 };
    }
    let session;
    try {
        session = sessions.get?.(sessionId);
    }
    catch {
        return { text: '', turns: 0, chars: 0 };
    }
    if (session === undefined)
        return { text: '', turns: 0, chars: 0 };
    let events;
    try {
        events = session.snapshotEvents?.() ?? [];
    }
    catch {
        return { text: '', turns: 0, chars: 0 };
    }
    const turns = [];
    let model;
    for (let index = events.length - 1; index >= 0 && turns.length < maxMessages; index -= 1) {
        const event = events[index];
        if (event === undefined)
            continue;
        if (event.type === 'request/header' && model === undefined) {
            const config = event.data?.header?.config;
            if (typeof config?.provider === 'string' && typeof config.model === 'string') {
                model = { provider: config.provider, model: config.model };
            }
            continue;
        }
        if (event.type === 'user/message') {
            const text = blocksToText(event.data?.content);
            if (text !== '')
                turns.push({ role: 'user', text });
            continue;
        }
        if (event.type === 'assistant/message') {
            if (event.data?.interrupted === true)
                continue;
            const text = blocksToText(event.data?.message?.content);
            if (text !== '')
                turns.push({ role: 'assistant', text });
        }
    }
    turns.reverse();
    // Budget from the newest turn backwards, then restore chronological order.
    const kept = [];
    let used = 0;
    let separator = 0;
    for (let index = turns.length - 1; index >= 0; index -= 1) {
        const turn = turns[index];
        if (turn === undefined)
            continue;
        const text = clip(turn.text, PER_TURN_MAX_CHARS);
        const cost = text.length + 8 + separator;
        if (kept.length > 0 && used + cost > maxChars)
            break;
        kept.push({ role: turn.role, text });
        used += cost;
        separator = 2;
    }
    kept.reverse();
    const text = kept
        .map(turn => (turn.role === 'user' ? '用户：' : '助手：') + turn.text)
        .join('\n\n');
    return { text, ...(model === undefined ? {} : { model }), turns: kept.length, chars: text.length };
}
/** The session workspace root, or undefined when the session cannot be read. */
export function readSessionCwd(sessions, sessionId) {
    if (sessionId === undefined || sessions === undefined)
        return undefined;
    try {
        const cwd = sessions.get?.(sessionId)?.header?.cwd;
        return typeof cwd === 'string' && cwd !== '' ? cwd : undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * Read only the model route the main session used last, without rebuilding a
 * transcript. Kept separate from {@link readTranscript} because a one-message
 * budget can stop the turn scan before it reaches the newest header.
 */
export function readSessionModel(sessions, sessionId) {
    if (sessionId === undefined || sessions === undefined)
        return undefined;
    let session;
    try {
        session = sessions.get?.(sessionId);
    }
    catch {
        return undefined;
    }
    if (session === undefined)
        return undefined;
    let events;
    try {
        events = session.snapshotEvents?.() ?? [];
    }
    catch {
        return undefined;
    }
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event?.type !== 'request/header')
            continue;
        const config = event.data?.header?.config;
        if (typeof config?.provider === 'string' && typeof config.model === 'string') {
            return { provider: config.provider, model: config.model };
        }
    }
    return undefined;
}
