import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve, sep } from 'node:path'

/** Bounds for one turn's read-only file snapshot. */
export interface FileGroundingOptions {
  cwd: string | undefined
  text: string
  maxFiles: number
  maxChars: number
  excerptChars: number
}

interface FileFact {
  path: string
  mtime: number
  size: number
  excerpt: string
}

interface DirectoryFact {
  path: string
  entries: Array<{ name: string; dir: boolean; size: number; mtime: number }>
}

const WIN_PATH = /[A-Za-z]:[\\/][^\s"'`<>|，。；：、（）《》]+/g
const POSIX_PATH = /(?:^|[\s("'`])((?:\/|\.{1,2}[\\/])[^\s"'`<>|，。；：、（）《》]+)/g
const FILE_NAME = /(?:^|[\s("'`])([A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|markdown|txt|yml|yaml|toml|ini|conf|css|scss|less|html|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|sh|ps1|sql|xml|svg|png|jpg|jpeg|gif|webp|pdf|docx|xlsx))(?=$|[\s)"'`，。；：、,;:!?])/g
const FILE_TOPIC = /文件|目录|路径|修改时间|更新时间|最近更新|file|folder|directory|path|mtime|modified|updated/i

function stripTrailing(value: string): string {
  return value.replace(/[),.;:!?，。；：、）】》]+$/u, '')
}

/** Every path-looking token in a piece of text, deduplicated in first-seen order. */
function candidates(text: string): string[] {
  const found: string[] = []
  const push = (value: string): void => {
    const cleaned = stripTrailing(value.trim())
    if (cleaned === '' || found.includes(cleaned)) return
    found.push(cleaned)
  }
  for (const match of text.matchAll(WIN_PATH)) push(match[0])
  for (const match of text.matchAll(POSIX_PATH)) push(match[1] ?? '')
  for (const match of text.matchAll(FILE_NAME)) push(match[1] ?? '')
  return found
}

function stamp(ms: number): string {
  const date = new Date(ms)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function bytes(size: number): string {
  return `${size.toLocaleString('en-US')} 字节`
}

/** Keep every read inside the session workspace, symlinks included. */
async function insideWorkspace(root: string, candidate: string): Promise<string | undefined> {
  const base = resolve(root)
  const absolute = isAbsolute(candidate) ? resolve(candidate) : resolve(base, candidate)
  if (absolute !== base && !absolute.startsWith(base + sep)) return undefined
  try {
    const actual = await realpath(absolute)
    if (actual !== base && !actual.startsWith(base + sep)) return undefined
    return actual
  } catch {
    return undefined
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** Resolve a bare file name against the workspace root and one level below it. */
async function findByBasename(root: string, name: string): Promise<string | undefined> {
  const direct = await insideWorkspace(root, name)
  if (direct !== undefined && await isFile(direct)) return direct
  const base = resolve(root)
  let entries
  try {
    entries = await readdir(base, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === name) {
      const candidate = await insideWorkspace(base, entry.name)
      if (candidate !== undefined) return candidate
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const candidate = await insideWorkspace(base, join(entry.name, name))
    if (candidate !== undefined && await isFile(candidate)) return candidate
  }
  return undefined
}

async function readFact(root: string, path: string, excerptChars: number): Promise<FileFact | undefined> {
  try {
    const info = await stat(path)
    if (!info.isFile()) return undefined
    let excerpt = ''
    if (excerptChars > 0) {
      const buffer = await readFile(path)
      const slice = buffer.subarray(0, Math.max(0, Math.min(buffer.length, excerptChars * 4)))
      if (!slice.includes(0)) excerpt = slice.toString('utf8').slice(0, excerptChars)
    }
    return { path, mtime: info.mtimeMs, size: info.size, excerpt }
  } catch {
    return undefined
  }
}

async function readDirectory(root: string, path: string): Promise<DirectoryFact | undefined> {
  try {
    const info = await stat(path)
    if (!info.isDirectory()) return undefined
    const entries = await readdir(path, { withFileTypes: true })
    const facts = [] as DirectoryFact['entries']
    for (const entry of entries.slice(0, 40)) {
      try {
        const detail = await stat(join(path, entry.name))
        facts.push({ name: entry.name, dir: entry.isDirectory(), size: detail.size, mtime: detail.mtimeMs })
      } catch {
        // A vanished entry is simply omitted.
      }
    }
    return { path, entries: facts }
  } catch {
    return undefined
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
export async function readFileGrounding(options: FileGroundingOptions): Promise<string> {
  const cwd = options.cwd?.trim()
  if (cwd === undefined || cwd === '' || options.maxFiles <= 0 || options.maxChars <= 0) return ''
  const root = resolve(cwd)
  const tokens = candidates(options.text)
  const files: FileFact[] = []
  const directories: DirectoryFact[] = []
  const seen = new Set<string>()

  for (const token of tokens) {
    if (files.length + directories.length >= options.maxFiles) break
    let path = await insideWorkspace(root, token)
    if (path === undefined) {
      // A bare name such as `DESIGN.zh.md` has no separator: search for it.
      if (!token.includes('/') && !token.includes('\\')) path = await findByBasename(root, token)
      if (path === undefined) continue
    }
    if (seen.has(path)) continue
    seen.add(path)
    const file = await readFact(root, path, options.excerptChars)
    if (file !== undefined) {
      files.push(file)
      continue
    }
    const directory = await readDirectory(root, path)
    if (directory !== undefined) directories.push(directory)
  }

  // Nothing explicit but the question is about files: offer the workspace root.
  if (files.length === 0 && directories.length === 0 && FILE_TOPIC.test(options.text)) {
    const directory = await readDirectory(root, root)
    if (directory !== undefined) directories.push(directory)
  }

  if (files.length === 0 && directories.length === 0) return ''

  const parts: string[] = [
    '下面是从用户本机工作区读取的只读信息，时间是本机本地时间，内容可能被截断。',
  ]
  let used = parts[0]?.length ?? 0
  for (const file of files) {
    const excerpt = file.excerpt === ''
      ? ''
      : `\n内容片段:\n<<<\n${file.excerpt}\n>>>`
    const block = `[文件] ${file.path}\n修改时间: ${stamp(file.mtime)}\n大小: ${bytes(file.size)}${excerpt}`
    if (used + block.length > options.maxChars) break
    parts.push(block)
    used += block.length
  }
  for (const directory of directories) {
    const listing = directory.entries
      .map(entry => `- ${entry.name}${entry.dir ? '/' : ''}  ${entry.dir ? '目录' : bytes(entry.size)}  ${stamp(entry.mtime)}`)
      .join('\n')
    const block = `[目录] ${directory.path}\n${listing}`
    if (used + block.length > options.maxChars) break
    parts.push(block)
    used += block.length
  }
  return parts.join('\n\n')
}
/**
 * Read the complete text of one workspace file as the primary context for a
 * selection made in the right sidebar's document preview.
 *
 * Unlike {@link readFileGrounding} (which discovers paths mentioned in text
 * and attaches short excerpts), this is an explicit request for one file: the
 * caller already knows the path, so the whole document is attached up to the
 * configured cap. Anything outside the session workspace is refused.
 */
export async function readFileContext(
  cwd: string | undefined,
  filePath: string | undefined,
  maxChars: number,
): Promise<string> {
  const root = cwd?.trim()
  if (root === undefined || root === '' || filePath === undefined || filePath.trim() === '' || maxChars <= 0) {
    return ''
  }
  const actual = await insideWorkspace(root, filePath)
  if (actual === undefined) return ''
  try {
    const info = await stat(actual)
    if (!info.isFile()) return ''
    const buffer = await readFile(actual)
    // A NUL byte means the preview is showing a binary; never feed it to the model.
    if (buffer.includes(0)) return ''
    // An HTML report is mostly markup, so a character budget alone would
    // spend the context on tags and answer nothing. Extract the readable
    // text first, then apply the same cap.
    const head = buffer.subarray(0, 512).toString('utf8')
    const isHtml = /^\s*<(!doctype|html|head|body|div|section|article|main|table|h[1-6]|p|ul|ol|pre)\b/i.test(head)
    const text = isHtml ? htmlToText(buffer.toString('utf8')) : buffer.toString('utf8')
    const clipped = text.length > maxChars ? `${text.slice(0, maxChars)}\n…（已截断）` : text
    return `路径: ${actual}\n修改时间: ${stamp(info.mtimeMs)}\n大小: ${bytes(info.size)}\n内容:\n<<<\n${clipped}\n>>>`
  } catch {
    return ''
  }
}

/**
 * Visible text of an HTML document: scripts, styles and tags removed.
 *
 * This prepares model context only. It never renders, never executes and
 * never returns markup, so the model reads the words rather than the tags.
 */
export function htmlToText(html: string): string {
  return html.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|main|header|footer|li|tr|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
