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
/**
 * Read the complete text of one workspace file as the primary context for a
 * selection made in the right sidebar's document preview.
 *
 * Unlike {@link readFileGrounding} (which discovers paths mentioned in text
 * and attaches short excerpts), this is an explicit request for one file: the
 * caller already knows the path, so the whole document is attached up to the
 * configured cap. Anything outside the session workspace is refused.
 */
export declare function readFileContext(cwd: string | undefined, filePath: string | undefined, maxChars: number): Promise<string>;
