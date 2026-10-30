import type { RectLike } from './types'

/** The conversation message flow, the trajectory view's container, the composer, and the document preview. */
const CHAT_SELECTOR = '[data-slot="conversation.chat.flow"]'
const MAIN_SELECTOR = '[data-slot="main.conversation"]'
const COMPOSER_SELECTOR = '[data-slot="conversation.composer"]'
const DOCUMENT_BODY_SELECTOR = '[data-textpreview-body]'
const DOCUMENT_ROOT_SELECTOR = '[data-textpreview-state]'
const FILE_MARKER_SELECTOR = '[data-explainer-file-path]'
/** The better-sidebar editor's native tab host and bottom-workbench pane. */
const BETTER_SIDEBAR_HOSTS = '[data-dsh-native-tab-host], [data-dsh-pane]'
const CARD_ATTR = 'data-explainer-card'
const EDITABLE_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'

/** Where a valid selection came from. */
export type SelectionKind = 'chat' | 'file'

/** One accepted selection with its anchor and, for file views, the absolute path. */
export interface DetectedSelection {
  kind: SelectionKind
  text: string
  rect: RectLike
  filePath?: string
}

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

/**
 * The absolute path published by the document preview's toolbar marker for the
 * preview root that contains this node. Inactive tabs keep their own marker,
 * so matching on the enclosing root avoids reporting another tab's file.
 */
function documentPathOf(node: Node | null): string | undefined {
  const element = elementOf(node)
  if (element === null) return undefined
  const body = element.closest(DOCUMENT_BODY_SELECTOR)
  if (body === null) return undefined
  const root = body.closest(DOCUMENT_ROOT_SELECTOR)
  if (root === null) return undefined
  const marker = root.querySelector(FILE_MARKER_SELECTOR)
  const path = marker?.getAttribute('data-explainer-file-path')?.trim()
  return path === undefined || path === '' ? undefined : path
}

/** A value that looks like a workspace path, not a search query or a button title. */
function pathLike(value: string | null | undefined): string | undefined {
  const text = value?.trim()
  if (text === undefined || text === '') return undefined
  if (text.length > 4096 || text.includes('\n')) return undefined
  // A directory-ish path or a file with an extension; both are safe for the
  // host to resolve against the session workspace.
  if (/[\\/]/.test(text)) return text
  return /^[^\\/]+\.(?:[a-z0-9]{1,8})$/i.test(text) ? text : undefined
}

/** The path input an editor header renders, whether it exposes title or only value. */
function inputPath(container: Element): string | undefined {
  for (const input of container.querySelectorAll('input[title]')) {
    const path = pathLike(input.getAttribute('title'))
    if (path !== undefined) return path
  }
  for (const input of container.querySelectorAll('input')) {
    const path = pathLike((input as HTMLInputElement).value)
    if (path !== undefined) return path
  }
  for (const element of container.querySelectorAll('[data-path], [data-file-path]')) {
    const path = pathLike(element.getAttribute('data-path') ?? element.getAttribute('data-file-path'))
    if (path !== undefined) return path
  }
  return undefined
}

/**
 * The file path the better-sidebar editor shows for the tab that contains
 * this node.
 *
 * The header's path input carries `title={path}` in current builds, but the
 * native tab shell does not always wrap the editor in a marked host (and some
 * builds render only the input's value). Use the marked host first, then walk
 * up to the nearest ancestor that owns a path input; the walk stops at the
 * nearest tab, so a neighbouring tab's header cannot win.
 */
function editorPathOf(node: Node | null): string | undefined {
  const element = elementOf(node)
  if (element === null) return undefined
  const host = element.closest(BETTER_SIDEBAR_HOSTS)
  if (host !== null) {
    const path = inputPath(host)
    if (path !== undefined) return path
  }
  let current: Element | null = element
  for (let depth = 0; depth < 12 && current !== null; depth += 1, current = current.parentElement) {
    const path = inputPath(current)
    if (path !== undefined) return path
  }
  return undefined
}

/** Resolve only a known preview/editor surface; never accept a path from iframe content. */
export function filePathOf(node: Node | null): string | undefined {
  return documentPathOf(node) ?? editorPathOf(node)
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

/**
 * Read a valid selection from the conversation or from the right sidebar's
 * document preview. The preview needs its file marker (installed by this
 * plugin's toolbar contribution); without one the selection is ignored.
 */
export function readSelection(view: Window = window, previewPath?: string): DetectedSelection | null {
  const selection = view.getSelection()
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (range.collapsed) return null
  if (isInsideOurCard(range.commonAncestorContainer)) return null
  const text = selectionText(selection)
  if (text.length < 2) return null
  const rect = selectionRect(range)
  if (rect === null) return null
  const capped = text.length > 20_000 ? text.slice(0, 20_000) : text

  const common = range.commonAncestorContainer
  if (previewPath !== undefined) {
    // Embedded preview inputs are UI, not the file being explained.
    if (isEditable(range.startContainer) || isEditable(range.endContainer)) return null
    return { kind: 'file', text: capped, rect, filePath: previewPath }
  }
  const filePath = filePathOf(common)
  if (filePath !== undefined && (filePathOf(range.startContainer) !== filePath
    || filePathOf(range.endContainer) !== filePath)) return null
  // A file selection may sit in a CodeMirror contenteditable; that is the
  // document being read, not a draft composer, so it is allowed here.
  if (filePath !== undefined) return { kind: 'file', text: capped, rect, filePath }
  if (isEditable(common)) return null
  if (inConversation(common)) return { kind: 'chat', text: capped, rect }
  return null
}

/** The same shapes the host uses to pick the default answer. */
export type SelectionShape = 'english-prose' | 'term' | 'question' | 'other'

const WORD = /[A-Za-z][A-Za-z'\u2019-]*/g
const CJK = /[\u3400-\u9fff\u3040-\u30ff]/g
const CODE = /[{}<>\x60=]|=>|\bfunction\b|\bconst\b|\bimport\b|\bdef\b|\bclass\b|\breturn\b/
const FINITE = /\b(is|are|was|were|be|been|has|have|had|does|do|did|can|could|will|would|shall|should|may|might|must|means|refers|describes|explains|allows|requires|contains|includes|supports|provides|creates|makes|uses|happens|works|becomes|seems|appears|shows|needs|returns|calls|says|tells|thinks|knows|sees|comes|goes|gives|takes|finds|keeps|holds|carries|brings|adds|removes|reads|writes|loads|saves|opens|closes|starts|stops|sends|receives|waits|fails|succeeds|exists)\b/i
const FILLER_START = /^(?:the\s+)?(?:concept|notion|idea|term|definition|meaning)\s+of\s+|^what\s+(?:is|are)\s+|^(?:explain|define)\s+|^(?:什么是|所谓|解释一下|解释|这个词|这个概念|术语)\s*/i
const FILLER_END = /\s*(?:的概念|这个概念|这个术语|术语|是什么意思|指的是什么|指什么|是什么|的定义)\s*[?？!！]?\s*$/

/**
 * Classify a selection exactly like the host does, so the card can promise
 * the same default and start it without a second round trip.
 * @param text - the selected text.
 * @returns English prose, a noun-phrase term, a question, or anything else.
 */
export function selectionShape(input: string): SelectionShape {
  const original = input.trim()
  if (original === '') return 'other'
  if (CODE.test(original)) return 'other'
  let text = original.replace(FILLER_START, '').replace(FILLER_END, '').trim()
  text = text.replace(/^[「“\x22'(\[]+|[」”\x22')\]]+$/g, '').trim()
  if (text === '') return 'other'
  const latin = text.match(WORD) ?? []
  const cjk = text.match(CJK) ?? []
  if (latin.length === 0) return 'other'
  if (cjk.length >= latin.join('').length / 2) return 'other'
  if (/[?？]\s*$/.test(text)) return 'question'
  const words = latin.length
  const sentences = (text.match(/[.!?](?=\s+[A-Z0-9])/g) ?? []).length
  if (words <= 2) return 'term'
  if (sentences >= 1) return 'english-prose'
  if (words >= 8) return 'english-prose'
  if (FINITE.test(text)) return 'english-prose'
  return 'term'
}

/** Whether a selection reads as English prose. */
export function isEnglishProse(text: string): boolean {
  return selectionShape(text) === 'english-prose'
}

/** Where the quick-ask window opens when there is no selection. */
export function findComposerRect(): RectLike | null {
  const element = document.querySelector(`${COMPOSER_SELECTOR}, .dsh-composer, [data-slot="conversation.composer.bar"]`)
  if (element === null) return null
  const rect = element.getBoundingClientRect()
  return rect.width === 0 && rect.height === 0 ? null : rect
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