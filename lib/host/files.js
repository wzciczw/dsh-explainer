import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
const WIN_PATH = /[A-Za-z]:[\\/][^\s"'`<>|，。；：、（）《》]+/g;
const POSIX_PATH = /(?:^|[\s("'`])((?:\/|\.{1,2}[\\/])[^\s"'`<>|，。；：、（）《》]+)/g;
const FILE_NAME = /(?:^|[\s("'`])([A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|markdown|txt|yml|yaml|toml|ini|conf|css|scss|less|html|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|sh|ps1|sql|xml|svg|png|jpg|jpeg|gif|webp|pdf|docx|xlsx))(?=$|[\s)"'`，。；：、,;:!?])/g;
const FILE_TOPIC = /文件|目录|路径|修改时间|更新时间|最近更新|file|folder|directory|path|mtime|modified|updated/i;
function stripTrailing(value) {
    return value.replace(/[),.;:!?，。；：、）】》]+$/u, '');
}
/** Every path-looking token in a piece of text, deduplicated in first-seen order. */
function candidates(text) {
    const found = [];
    const push = (value) => {
        const cleaned = stripTrailing(value.trim());
        if (cleaned === '' || found.includes(cleaned))
            return;
        found.push(cleaned);
    };
    for (const match of text.matchAll(WIN_PATH))
        push(match[0]);
    for (const match of text.matchAll(POSIX_PATH))
        push(match[1] ?? '');
    for (const match of text.matchAll(FILE_NAME))
        push(match[1] ?? '');
    return found;
}
function stamp(ms) {
    const date = new Date(ms);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function bytes(size) {
    return `${size.toLocaleString('en-US')} 字节`;
}
/** Keep every read inside the session workspace, symlinks included. */
async function insideWorkspace(root, candidate) {
    const base = resolve(root);
    const absolute = isAbsolute(candidate) ? resolve(candidate) : resolve(base, candidate);
    if (absolute !== base && !absolute.startsWith(base + sep))
        return undefined;
    try {
        const actual = await realpath(absolute);
        if (actual !== base && !actual.startsWith(base + sep))
            return undefined;
        return actual;
    }
    catch {
        return undefined;
    }
}
async function isFile(path) {
    try {
        return (await stat(path)).isFile();
    }
    catch {
        return false;
    }
}
/** Resolve a bare file name against the workspace root and one level below it. */
async function findByBasename(root, name) {
    const direct = await insideWorkspace(root, name);
    if (direct !== undefined && await isFile(direct))
        return direct;
    const base = resolve(root);
    let entries;
    try {
        entries = await readdir(base, { withFileTypes: true });
    }
    catch {
        return undefined;
    }
    for (const entry of entries) {
        if (entry.isFile() && entry.name === name) {
            const candidate = await insideWorkspace(base, entry.name);
            if (candidate !== undefined)
                return candidate;
        }
    }
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules')
            continue;
        const candidate = await insideWorkspace(base, join(entry.name, name));
        if (candidate !== undefined && await isFile(candidate))
            return candidate;
    }
    return undefined;
}
async function readFact(root, path, excerptChars) {
    try {
        const info = await stat(path);
        if (!info.isFile())
            return undefined;
        let excerpt = '';
        if (excerptChars > 0) {
            const buffer = await readFile(path);
            const slice = buffer.subarray(0, Math.max(0, Math.min(buffer.length, excerptChars * 4)));
            if (!slice.includes(0))
                excerpt = slice.toString('utf8').slice(0, excerptChars);
        }
        return { path, mtime: info.mtimeMs, size: info.size, excerpt };
    }
    catch {
        return undefined;
    }
}
async function readDirectory(root, path) {
    try {
        const info = await stat(path);
        if (!info.isDirectory())
            return undefined;
        const entries = await readdir(path, { withFileTypes: true });
        const facts = [];
        for (const entry of entries.slice(0, 40)) {
            try {
                const detail = await stat(join(path, entry.name));
                facts.push({ name: entry.name, dir: entry.isDirectory(), size: detail.size, mtime: detail.mtimeMs });
            }
            catch {
                // A vanished entry is simply omitted.
            }
        }
        return { path, entries: facts };
    }
    catch {
        return undefined;
    }
}
/**
 * Read a bounded, read-only snapshot of the files the user's text points at.
 *
 * This is what gives the one-shot quick-ask model real filesystem facts without
 * giving it tools: paths mentioned in the selection, the question or the
 * inherited conversation are resolved inside the session workspace, and their
 * mtime, size and a short excerpt are appended to the prompt.
 */
export async function readFileGrounding(options) {
    const cwd = options.cwd?.trim();
    if (cwd === undefined || cwd === '' || options.maxFiles <= 0 || options.maxChars <= 0)
        return '';
    const root = resolve(cwd);
    const tokens = candidates(options.text);
    const files = [];
    const directories = [];
    const seen = new Set();
    for (const token of tokens) {
        if (files.length + directories.length >= options.maxFiles)
            break;
        let path = await insideWorkspace(root, token);
        if (path === undefined) {
            // A bare name such as `DESIGN.zh.md` has no separator: search for it.
            if (!token.includes('/') && !token.includes('\\'))
                path = await findByBasename(root, token);
            if (path === undefined)
                continue;
        }
        if (seen.has(path))
            continue;
        seen.add(path);
        const file = await readFact(root, path, options.excerptChars);
        if (file !== undefined) {
            files.push(file);
            continue;
        }
        const directory = await readDirectory(root, path);
        if (directory !== undefined)
            directories.push(directory);
    }
    // Nothing explicit but the question is about files: offer the workspace root.
    if (files.length === 0 && directories.length === 0 && FILE_TOPIC.test(options.text)) {
        const directory = await readDirectory(root, root);
        if (directory !== undefined)
            directories.push(directory);
    }
    if (files.length === 0 && directories.length === 0)
        return '';
    const parts = [
        '下面是从用户本机工作区读取的只读信息，时间是本机本地时间，内容可能被截断。',
    ];
    let used = parts[0]?.length ?? 0;
    for (const file of files) {
        const excerpt = file.excerpt === ''
            ? ''
            : `\n内容片段:\n<<<\n${file.excerpt}\n>>>`;
        const block = `[文件] ${file.path}\n修改时间: ${stamp(file.mtime)}\n大小: ${bytes(file.size)}${excerpt}`;
        if (used + block.length > options.maxChars)
            break;
        parts.push(block);
        used += block.length;
    }
    for (const directory of directories) {
        const listing = directory.entries
            .map(entry => `- ${entry.name}${entry.dir ? '/' : ''}  ${entry.dir ? '目录' : bytes(entry.size)}  ${stamp(entry.mtime)}`)
            .join('\n');
        const block = `[目录] ${directory.path}\n${listing}`;
        if (used + block.length > options.maxChars)
            break;
        parts.push(block);
        used += block.length;
    }
    return parts.join('\n\n');
}
