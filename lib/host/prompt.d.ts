/** The fixed persona. Short by design: the answer shape is the product. */
export declare const SYSTEM_PROMPT: string;
/** Clean untrusted input before it enters a prompt. */
export declare function normalizeText(value: string | undefined, max: number): string;
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
