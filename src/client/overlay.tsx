import * as React from 'react'
import type { ExplainerStore } from './store'
import type { CardState, Turn } from './types'
import { Markdown } from './markdown'
import { findComposerRect, readSelection, selectionShape } from './selection'
import { observePreviewFrames } from './preview-frames'
import { useStore } from './use-store'

export type Translate = (key: string) => string

/** Selector hook supplied by the shell.overlay standard props. */
type UseSessions = (select: (state: {
  byId: Record<string, { retainedBy?: { mainView?: number } }>
}) => unknown) => unknown

const WIDTH = 440
const MARGIN = 12

/** Human labels for the adapter-owned reasoning effort ids. */
const EFFORT_LABELS: Record<string, string> = {
  off: 'effortOff',
  minimal: 'effortMinimal',
  low: 'effortLow',
  medium: 'effortMedium',
  high: 'effortHigh',
  xhigh: 'effortXhigh',
  max: 'effortMax',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function friendlyError(turn: Turn, t: Translate): string {
  switch (turn.errorCode) {
    case 'timeout': return t('timeout')
    case 'aborted': return t('stopped')
    case 'busy': return t('busy')
    case 'no-model': return t('noModel')
    case 'empty-answer': return t('emptyAnswer')
    default: return turn.error ?? t('emptyAnswer')
  }
}

/** Position the window under the anchor, flipping above when it fits better. */
function place(card: CardState): React.CSSProperties {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const width = Math.min(WIDTH, viewportWidth - MARGIN * 2)
  if (card.position !== null) {
    const x = clamp(card.position.x, MARGIN, viewportWidth - width - MARGIN)
    const y = clamp(card.position.y, MARGIN, viewportHeight - 160)
    return { left: x, top: y, width, maxHeight: viewportHeight - y - MARGIN }
  }
  const anchor = card.anchor
  const below = anchor.bottom + 8
  const roomBelow = viewportHeight - below - MARGIN
  const roomAbove = anchor.top - 8 - MARGIN
  const width2 = width
  const left = clamp(anchor.left, MARGIN, viewportWidth - width2 - MARGIN)
  if (roomBelow >= 300 || roomBelow >= roomAbove) {
    return { left, top: Math.max(MARGIN, below), width: width2, maxHeight: Math.max(220, roomBelow) }
  }
  return { left, bottom: viewportHeight - anchor.top + 8, width: width2, maxHeight: Math.max(220, roomAbove) }
}

/** The floating layer: the selection pill, the quick-ask window and a toast. */
export function Overlay(props: {
  store: ExplainerStore
  t: Translate
  useSessions: UseSessions
}): React.ReactElement {
  const { store, t, useSessions } = props
  const snapshot = useStore(store, value => value)
  const sessionId = useSessions(state => {
    for (const [id, entry] of Object.entries(state.byId)) {
      if ((entry.retainedBy?.mainView ?? 0) > 0) return id
    }
    return undefined
  })

  React.useEffect(() => {
    void store.ensureConfig()
  }, [store])

  React.useEffect(() => {
    store.setSessionId(typeof sessionId === 'string' ? sessionId : null)
  }, [store, sessionId])

  React.useEffect(() => {
    let pointerDown = false
    let timer = 0
    const compute = (): void => {
      const found = readSelection()
      if (found === null) store.hideHint()
      else store.showHint(found.text, found.rect, found.filePath)
    }
    const onDown = (): void => { pointerDown = true }
    const onUp = (): void => {
      pointerDown = false
      window.clearTimeout(timer)
      timer = window.setTimeout(compute, 16)
    }
    const onSelectionChange = (): void => {
      if (pointerDown) return
      window.clearTimeout(timer)
      timer = window.setTimeout(compute, 160)
    }
    const onScroll = (): void => { store.hideHint() }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [store])

  React.useEffect(() => observePreviewFrames(document, {
    hint: found => {
      if (found === null) store.hideHint()
      else store.showHint(found.text, found.rect, found.filePath)
    },
    open: found => store.openSelection(found.rect, found.text, found.filePath),
    pointerDown: () => store.close(),
    enabled: () => store.getSnapshot().config?.enabled !== false,
    rightClick: () => store.getSnapshot().config?.rightClick !== false,
    escape: () => {
      if (store.getSnapshot().card?.phase === 'streaming') store.stop()
      else store.close()
    },
  }), [store])

  // Clicking anywhere outside the window closes it. The launcher and the
  // selection pill keep their own click behaviour.
  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null
      if (target === null) return
      if (target.closest('.dx-card, .dx-pill, .dx-launcher') !== null) return
      store.close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [store])

  // Selecting text and right-clicking opens the window directly. Registered in
  // the capture phase so a host menu cannot swallow it, and only when the
  // capture is a valid chat selection.
  React.useEffect(() => {
    const onContextMenu = (event: MouseEvent): void => {
      const snapshot = store.getSnapshot()
      if (snapshot.config?.enabled === false || snapshot.config?.rightClick === false) return
      const target = event.target as HTMLElement | null
      if (target === null) return
      if (target.closest('.dx-card, .dx-pill, .dx-launcher') !== null) return
      const found = readSelection()
      if (found === null) return
      event.preventDefault()
      store.openSelection(found.rect, found.text, found.filePath)
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => { document.removeEventListener('contextmenu', onContextMenu, true) }
  }, [store])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.shiftKey && (event.key === 'K' || event.key === 'k')) {
        event.preventDefault()
        const rect = findComposerRect()
        if (rect === null) store.notify(t('noBridge'))
        else store.openQuick(rect)
        return
      }
      if (mod && event.shiftKey && (event.key === 'E' || event.key === 'e')) {
        event.preventDefault()
        const found = readSelection()
        if (found === null) store.notify(t('selectFirst'))
        else store.openSelection(found.rect, found.text, found.filePath)
        return
      }
      if (event.key === 'Escape') {
        const card = store.getSnapshot().card
        if (card !== null && card.phase === 'streaming') store.stop()
        else if (card !== null) store.close()
        else store.hideHint()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true) }
  }, [store, t])

  const hint = snapshot.hint
  const card = snapshot.card
  const notice = snapshot.notice

  return (
    <>
      {hint !== null && (
        <button
          type="button"
          className="dx-pill"
          style={{
            left: clamp(hint.rect.left, MARGIN, window.innerWidth - 150),
            top: clamp(hint.rect.bottom + 8, MARGIN, window.innerHeight - 44),
          }}
          title={t('rightClickHint')}
          onMouseDown={event => event.preventDefault()}
          onClick={() => store.openSelection(hint.rect, hint.text, hint.filePath, hint.sessionId)}
        >
          <span className="dx-spark">✦</span>
          {t('askSelection')}
        </button>
      )}
      {card !== null && (
        <Card
          store={store}
          card={card}
          t={t}
          showMeta={snapshot.config?.showMeta ?? true}
          hasBridge={snapshot.bridge !== null}
          route={store.effectiveRoute()}
          pinned={store.isPinnedModel()}
        />
      )}
      {notice !== null && <div className="dx-toast">{notice.text}</div>}
    </>
  )
}
/** The quick-ask window: header, quote, transcript, presets and a always-on composer. */
function Card(props: {
  store: ExplainerStore
  card: CardState
  t: Translate
  showMeta: boolean
  hasBridge: boolean
  /** The model this window will answer with, if it is known yet. */
  route: { provider: string; model: string } | null
  /** True when the plugin row pinned the model instead of following the chat. */
  pinned: boolean
}): React.ReactElement {
  const { store, card, t, showMeta, hasBridge, route, pinned } = props
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null)
  const bodyRef = React.useRef<HTMLDivElement | null>(null)
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  const drag = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [, tick] = React.useState(0)

  React.useEffect(() => {
    const onResize = (): void => tick(value => value + 1)
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [])

  // Focus the composer once per thread, not on every phase change: after an
  // answer the user may be reading, and stealing focus would be hostile.
  React.useEffect(() => {
    if (card.phase !== 'streaming') inputRef.current?.focus()
  }, [card.threadId])

  const last = card.messages[card.messages.length - 1]
  const lastText = last?.text ?? ''
  React.useEffect(() => {
    const element = bodyRef.current
    if (element === null) return
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 90
    if (nearBottom) element.scrollTop = element.scrollHeight
  }, [card.messages.length, lastText])

  React.useEffect(() => {
    const element = inputRef.current
    if (element === null) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(132, Math.max(36, element.scrollHeight))}px`
  }, [card.draft])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    if (target.closest('button') !== null) return
    const element = cardRef.current
    if (element === null) return
    const rect = element.getBoundingClientRect()
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = drag.current
    if (state === null) return
    const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2)
    const x = clamp(state.left + event.clientX - state.x, MARGIN, window.innerWidth - width - MARGIN)
    const y = clamp(state.top + event.clientY - state.y, MARGIN, window.innerHeight - 160)
    store.moveTo(x, y)
  }
  const onPointerUp = (): void => { drag.current = null }

  const streaming = card.phase === 'streaming'
  const canSend = streaming || card.draft.trim() !== '' || (card.messages.length === 0 && card.mode === 'selection')
  const placeholder = card.messages.length === 0
    ? (card.mode === 'selection'
        ? (card.filePath !== undefined && card.quote === ''
            ? t('placeholderFile')
            : selectionShape(card.quote) === 'english-prose'
              ? t('placeholderTranslate')
              : selectionShape(card.quote) === 'term'
                ? t('placeholderTerm')
                : (selectionShape(card.quote) === 'question' ? t('placeholderQuestion') : t('placeholderSelection')))
        : t('placeholderQuick'))
    : t('placeholderFollow')

  const presets: Array<{ id: string; label: string; question: string }> = [
    { id: 'explain', label: t('presetExplain'), question: '' },
    { id: 'translate', label: t('presetTranslate'), question: t('presetTranslateQuestion') },
    { id: 'summary', label: t('presetSummary'), question: t('presetSummaryQuestion') },
    { id: 'example', label: t('presetExample'), question: t('presetExampleQuestion') },
  ]

  return (
    <div ref={cardRef} className="dx-card" style={place(card)} data-explainer-card="" role="dialog" aria-label={t('quickAsk')}>
      <div
        className="dx-head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="dx-title">
          <span className="dx-spark">✦</span>
          {card.mode === 'selection' ? t('askSelection') : t('quickAsk')}
        </span>
        {card.filePath !== undefined && (
          <span className="dx-badge dx-file" title={card.filePath}>
            {card.filePath.split(/[\\/]/).pop()}
          </span>
        )}
        {route !== null && (
          <span
            className="dx-badge dx-model"
            title={pinned ? t('pinnedModel') : t('sameModel')}
          >{route.model}</span>
        )}
        <span className="dx-grow" />
        <button
          type="button"
          className="dx-icon"
          title={t('newThread')}
          aria-label={t('newThread')}
          disabled={card.messages.length === 0 && card.draft === ''}
          onClick={() => store.newThread()}
        >↺</button>
      </div>

      {card.quote !== '' && (
        <div
          className="dx-quote"
          data-expanded={card.quoteExpanded}
          onClick={() => store.toggleQuote()}
        >{card.quote}</div>
      )}

      <div className="dx-body" ref={bodyRef}>
        {card.messages.map((item, index) => (
          <TurnView
            key={item.id}
            store={store}
            t={t}
            turn={item}
            hasBridge={hasBridge}
            isLast={index === card.messages.length - 1 && !streaming}
          />
        ))}
      </div>

      {card.messages.length === 0 && card.mode === 'selection' && (
        <div className="dx-presets">
          {presets.map(preset => (
            <button
              key={preset.id}
              type="button"
              className="dx-chip"
              onClick={() => {
                store.setDraft(preset.question)
                void store.send()
              }}
            >{preset.label}</button>
          ))}
        </div>
      )}

      <div className="dx-compose">
        <textarea
          ref={inputRef}
          className="dx-input"
          rows={1}
          value={card.draft}
          placeholder={placeholder}
          spellCheck={false}
          aria-label={placeholder}
          onChange={event => store.setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (!streaming) void store.send()
            }
          }}
        />
        <button
          type="button"
          className="dx-send"
          data-mode={streaming ? 'stop' : undefined}
          title={streaming ? t('stop') : t('send')}
          aria-label={streaming ? t('stop') : t('send')}
          disabled={!canSend}
          onClick={() => { if (streaming) store.stop(); else void store.send() }}
        >{streaming ? '■' : '↑'}</button>
      </div>

      {showMeta && (card.meta !== null || card.phase === 'answer') && (
        <MetaLine card={card} t={t} />
      )}
    </div>
  )
}
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path: the clipboard API is permission-gated.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

/** One transcript bubble with its per-answer actions. */
const TurnView = React.memo(function TurnView(props: {
  store: ExplainerStore
  t: Translate
  turn: Turn
  hasBridge: boolean
  isLast: boolean
}): React.ReactElement {
  const { store, t, turn, hasBridge, isLast } = props
  const assistant = turn.role === 'assistant'
  return (
    <div className="dx-turn" data-role={turn.role} data-active={isLast ? 'true' : undefined}>
      <div className="dx-bubble" data-error={turn.error !== undefined ? 'true' : undefined}>
        {assistant
          ? (turn.text !== '' ? <Markdown text={turn.text} /> : null)
          : turn.text}
        {turn.streaming === true && <span className="dx-cursor" />}
        {turn.error !== undefined && <div>{friendlyError(turn, t)}</div>}
      </div>
      {assistant && turn.streaming !== true && isLast && (turn.text !== '' || turn.error !== undefined) && (
        <div className="dx-turn-actions">
          {turn.text !== '' && (
            <button
              type="button"
              className="dx-mini"
              onClick={() => {
                void copyText(turn.text).then(ok => store.notify(ok ? t('copied') : t('copyFailed')))
              }}
            >{t('copy')}</button>
          )}
          {turn.text !== '' && hasBridge && (
            <button
              type="button"
              className="dx-mini"
              onClick={() => {
                const ok = store.insertToComposer(turn.text)
                store.notify(ok ? t('inserted') : t('noBridge'))
              }}
            >{t('insert')}</button>
          )}
          {hasBridge && (
            <button
              type="button"
              className="dx-mini"
              onClick={() => {
                const ok = store.escalateToSession()
                store.notify(ok ? t('escalated') : t('noBridge'))
                if (ok) store.close()
              }}
            >{t('escalate')}</button>
          )}
          {turn.error !== undefined && (
            <button type="button" className="dx-mini" onClick={() => store.retry()}>
              {t('retry')}
            </button>
          )}
        </div>
      )}
    </div>
  )
})

/** The small grey line under the window: route, effort, latency, context size. */
function MetaLine({ card, t }: { card: CardState; t: Translate }): React.ReactElement | null {
  const meta = card.meta
  const parts: string[] = []
  if (meta?.model !== undefined && meta.model !== '') parts.push(meta.model)
  if (meta?.effort !== undefined && meta.effort !== '') {
    const label = EFFORT_LABELS[meta.effort]
    parts.push(label === undefined ? meta.effort : t(label))
  }
  if (meta?.ms !== undefined) parts.push(`${(meta.ms / 1000).toFixed(1)}s`)
  if ((meta?.contextChars ?? 0) > 0) parts.push(t('contextChars').replace('{n}', String(meta?.contextChars)))
  if (parts.length === 0) return null
  const nodes: React.ReactNode[] = []
  parts.forEach((part, index) => {
    if (index > 0) nodes.push(<span key={`d${index}`} className="dx-dot">·</span>)
    nodes.push(<span key={`p${index}`}>{part}</span>)
  })
  return <div className="dx-meta">{nodes}</div>
}