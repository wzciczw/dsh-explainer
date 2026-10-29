import type { RectLike } from './types'

/** The conversation message flow, the trajectory view's container, and the composer. */
const CHAT_SELECTOR = '[data-slot="conversation.chat.flow"]'
const MAIN_SELECTOR = '[data-slot="main.conversation"]'
const COMPOSER_SELECTOR = '[data-slot="conversation.composer"]'
const CARD_ATTR = 'data-explainer-card'
const EDITABLE_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'

function elementOf(node: Node | null): Element | null {
  if (node === null) return null
  return node.nodeType === 1 ? (node as Element) : node.parentElement
}

/** Whether a node belongs to the composer or any other editable surface. */
export function isEditable(node: Node | null): boolean {
  const element = elementOf(node)
  if (element === null) return false
  if (element.closest(EDITABLE_SELECTOR) !== null) return true
  const html = element as HTMLElement
  return html.isContentEditable === true
}

function isInsideOurCard(node: Node | null): boolean {
  const element = elementOf(node)
  return element !== null && element.closest(`[${CARD_ATTR}]`) !== null
}

/** Whether a node lives in the conversation column rather than the shell around it. */
function inConversation(node: Node | null): boolean {
  const element = elementOf(node)
  if (element === null) return false
  if (element.closest(COMPOSER_SELECTOR) !== null) return false
  return element.closest(CHAT_SELECTOR) !== null || element.closest(MAIN_SELECTOR) !== null
}

/** Normalize a DOM selection into plain text while keeping paragraph breaks. */
function selectionText(selection: Selection): string {
  return selection
    .toString()
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The last line of a multi-line selection is where the affordance belongs. */
function selectionRect(range: Range): RectLike | null {
  const rects = range.getClientRects()
  if (rects.length > 0) {
    const last = rects[rects.length - 1]
    if (last !== undefined) return last
  }
  const bounds = range.getBoundingClientRect()
  return bounds.width === 0 && bounds.height === 0 ? null : bounds
}

/** Read a valid chat selection, or null when it is empty or out of scope. */
export function readChatSelection(): { text: string; rect: RectLike } | null {
  const selection = window.getSelection()
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (range.collapsed) return null
  if (isInsideOurCard(range.commonAncestorContainer)) return null
  if (isEditable(range.commonAncestorContainer)) return null
  if (!inConversation(range.commonAncestorContainer)) return null
  const text = selectionText(selection)
  if (text.length < 2) return null
  const rect = selectionRect(range)
  if (rect === null) return null
  return { text: text.length > 20_000 ? text.slice(0, 20_000) : text, rect }
}

/** Where the quick-ask window opens when there is no selection. */
export function findComposerRect(): RectLike | null {
  const element = document.querySelector(`${COMPOSER_SELECTOR}, .dsh-composer, [data-slot="conversation.composer.bar"]`)
  if (element === null) return null
  const rect = element.getBoundingClientRect()
  return rect.width === 0 && rect.height === 0 ? null : rect
}

/** Whether two rectangles are close enough to skip a hint reposition. */
export function sameRect(a: RectLike, b: RectLike): boolean {
  return Math.abs(a.left - b.left) < 2
    && Math.abs(a.top - b.top) < 2
    && Math.abs(a.width - b.width) < 2
}

/** Keep a floating box inside the viewport with a small margin. */
export function clampBox(rect: RectLike, width: number, height: number, margin = 12): { left: number; top: number } {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - width - margin))
  let top = rect.bottom + 8
  if (top + height > viewportHeight - margin && rect.top - height - 8 > margin) {
    top = rect.top - height - 8
  }
  top = Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - height - margin))
  return { left, top }
}