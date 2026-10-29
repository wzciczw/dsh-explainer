import * as React from 'react'

/**
 * A deliberately small Markdown renderer.
 *
 * It builds React elements from tokens instead of setting HTML, so model
 * output can never inject markup. The syntax subset is the one quick answers
 * actually use: paragraphs, short lists, fenced code, headings, quotes, bold,
 * inline code and absolute links.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g

function safeHref(raw: string): string | undefined {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  let key = 0
  INLINE.lastIndex = 0
  let match = INLINE.exec(text)
  while (match !== null) {
    const token = match[0]
    if (match.index > last) nodes.push(text.slice(last, match.index))
    if (token.startsWith('**')) {
      nodes.push(React.createElement('strong', { key: `b${key}` }, token.slice(2, -2)))
    } else if (token.startsWith('`')) {
      nodes.push(React.createElement('code', { key: `c${key}` }, token.slice(1, -1)))
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      const href = link === null ? undefined : safeHref(link[2] ?? '')
      if (link !== null && href !== undefined) {
        nodes.push(React.createElement('a', {
          key: `a${key}`,
          href,
          target: '_blank',
          rel: 'noreferrer noopener',
        }, link[1]))
      } else {
        nodes.push(token)
      }
    }
    key += 1
    last = match.index + token.length
    match = INLINE.exec(text)
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Render one answer. Memoized by `text` at the component boundary. */
export const Markdown = React.memo(function Markdown({ text }: { text: string }): React.ReactElement {
  const blocks: React.ReactNode[] = []
  const lines = text.split('\n')
  let index = 0
  let key = 0

  const pushParagraph = (): void => {
    const paragraph: string[] = []
    while (index < lines.length) {
      const line = lines[index] ?? ''
      if (line.trim() === '' || /^\s*(```|#{1,3}\s|[-*•]\s|\d+[.)]\s|>)/.test(line)) break
      paragraph.push(line)
      index += 1
    }
    if (paragraph.length === 0) return
    blocks.push(React.createElement('p', { key: key++ }, ...renderInline(paragraph.join('\n'))))
  }

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }
    if (/^```/.test(line)) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '')
        index += 1
      }
      index += 1
      blocks.push(React.createElement('pre', { key: key++ }, React.createElement('code', null, code.join('\n'))))
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading !== null) {
      const level = Math.min(3, (heading[1] ?? '#').length)
      blocks.push(React.createElement(`h${level}`, { key: key++ }, ...renderInline(heading[2] ?? '')))
      index += 1
      continue
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    if (bullet !== null) {
      const items: React.ReactNode[] = []
      while (index < lines.length) {
        const item = /^\s*[-*•]\s+(.*)$/.exec(lines[index] ?? '')
        if (item === null) break
        items.push(React.createElement('li', { key: items.length }, ...renderInline(item[1] ?? '')))
        index += 1
      }
      blocks.push(React.createElement('ul', { key: key++ }, ...items))
      continue
    }
    const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line)
    if (ordered !== null) {
      const items: React.ReactNode[] = []
      while (index < lines.length) {
        const item = /^\s*(\d+)[.)]\s+(.*)$/.exec(lines[index] ?? '')
        if (item === null) break
        items.push(React.createElement('li', { key: items.length }, ...renderInline(item[2] ?? '')))
        index += 1
      }
      blocks.push(React.createElement('ol', { key: key++ }, ...items))
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(React.createElement('blockquote', { key: key++ }, ...renderInline(quote.join('\n'))))
      continue
    }
    pushParagraph()
  }

  return React.createElement('div', { className: 'dx-md' }, ...blocks)
})