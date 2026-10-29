/** Bounds for one turn's read-only file snapshot. */
export interface FileGroundingOptions {
    cwd: string | undefined;
    text: string;
    maxFiles: number;
    maxChars: number;
    excerptChars: number;
}
/**
 * Read a bounded, read-only snapshot of the files the user's text points at.
 *
 * This is what gives the one-shot quick-ask model real filesystem facts without
 * giving it tools: paths mentioned in the selection, the question or the
 * inherited conversation are resolved inside the session workspace, and their
 * mtime, size and a short excerpt are appended to the prompt.
 */
export declare function readFileGrounding(options: FileGroundingOptions): Promise<string>;
