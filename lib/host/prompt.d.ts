/** The fixed persona. Short by design: the answer shape is the product. */
export declare const SYSTEM_PROMPT: string;
/** Clean untrusted input before it enters a prompt. */
export declare function normalizeText(value: string | undefined, max: number): string;
/** What the selection looks like, for choosing the default answer shape. */
export type SelectionShape = 'english-prose' | 'term' | 'question' | 'other';
/**
 * Classify a selection so the default answer is the one the user expects.
 *
 * - english-prose: a sentence or clause — translate it.
 * - term: a noun phrase, even with a couple of filler words around it —
 *   explain the concept instead of translating it.
 * - question: a real question — answer it.
 * - other: Chinese text, code, or anything ambiguous — explain it.
 * @param selection - the selected text, already trimmed.
 * @returns the shape that picks the default instruction.
 */
export declare function selectionShape(selection: string): SelectionShape;
/** The default instruction for a selection the user did not type a question for. */
export declare function defaultInstruction(shape: SelectionShape): string;
/** The first user turn of a quick-ask thread. */
export declare function composeOpening(input: {
    selection: string;
    question: string;
    context: string;
    files: string;
    file: string;
}): string;
/** A follow-up turn appended to an existing quick-ask thread. */
export declare function composeFollowUp(question: string, files?: string): string;
