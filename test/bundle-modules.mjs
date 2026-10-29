import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function bodyOf(name) {
  const start = source.indexOf(`__defs[${JSON.stringify(name)}] = function`)
  if (start < 0) return null
  const index = source.indexOf('(module, exports, require) {', start) + '(module, exports, require) {'.length
  let depth = 1
  let cursor = index
  while (cursor < source.length) {
    const ch = source[cursor]
    if (ch === '"' || ch === "'") {
      const quote = ch
      cursor += 1
      while (cursor < source.length) {
        if (source[cursor] === '\\') { cursor += 2; continue }
        if (source[cursor] === quote) break
        cursor += 1
      }
      cursor += 1
      continue
    }
    if (ch === '/' && source[cursor + 1] === '/') {
      while (cursor < source.length && source[cursor] !== '\n') cursor += 1
      continue
    }
    if (ch === '/' && source[cursor + 1] === '*') {
      const close = source.indexOf('*/', cursor + 2)
      cursor = close < 0 ? source.length : close + 2
      continue
    }
    if (ch === '/') {
      // Regex literal ('/' is only a comment opener above): skip its body so
      // braces and quotes inside it cannot unbalance the matcher.
      let inClass = false
      cursor += 1
      while (cursor < source.length) {
        const c = source[cursor]
        if (c === '\\') { cursor += 2; continue }
        if (c === '\n') break
        if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) { cursor += 1; break }
        cursor += 1
      }
      while (cursor < source.length && /[a-z]/i.test(source[cursor])) cursor += 1
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(index, cursor)
    }
    cursor += 1
  }
  assert.fail(`unbalanced module ${name}`)
}

/**
 * Materialize one module from the shipped bundle's table.
 *
 * A module without `__esModule` is exported as `{ default: value }`, matching
 * `__importDefault` in the bundle, so `import DOMPurify from` keeps working.
 */
export function loadBundleModule(name, cache = new Map()) {
  if (cache.has(name)) return cache.get(name)
  const body = bodyOf(name)
  assert.ok(body !== null, `bundle is missing ${name}`)
  const factory = new Function('module', 'exports', 'require', body)
  const module = { exports: {} }
  cache.set(name, module.exports)
  factory(module, module.exports, (id) => {
    if (id === 'react') return { createElement: () => null, memo: (c) => c, Fragment: 'F' }
    if (id === 'dompurify') return loadBundleModule('dompurify', cache)
    if (id.startsWith('./')) return loadBundleModule(id.slice(2).replace(/\.js$/, ''), cache)
    throw new Error(`unexpected require ${id}`)
  })
  // Keep the post-execution value: the factory may replace module.exports itself.
  const exported = module.exports
  cache.set(name, exported)
  return exported
}
