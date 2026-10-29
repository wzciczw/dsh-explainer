import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

/** The harness `require` provides React; this shim only needs what module load touches. */
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  memo: (component) => component,
  Fragment: 'Fragment',
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useSyncExternalStore: () => undefined,
}

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

test('the built client bundle loads and registers both seats', () => {
  let entry
  const appended = []
  const sandbox = {
    window: { __ModuleLoader__: { load: (value) => { entry = value } } },
    document: {
      createElement: () => ({ setAttribute() {}, setAttributeNS() {}, textContent: '', remove() {} }),
      head: { appendChild: (node) => appended.push(node) },
    },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    crypto: globalThis.crypto,
    fetch: () => Promise.reject(new Error('offline')),
    URL,
    TextDecoder,
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)

  assert.ok(entry !== undefined, 'client.js must call __ModuleLoader__.load')
  assert.equal(entry.id, 'dsh-explainer')

  const modules = new Map()
  const module = entry.factory((id) => {
    if (id === 'react') return react
    throw new Error(`unexpected runtime require: ${id}`)
  })
  assert.equal(module.name, 'dsh-explainer')
  assert.equal(Array.from(module.inject).join(','), 'slots,locale')

  const seats = []
  const effects = []
  const context = {
    slots: {
      inject: (key, register) => { register() },
      register: (options) => { seats.push(options); return () => {} },
    },
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    effect: (fn) => { effects.push(fn()) },
  }

  module.apply(context)

  assert.deepEqual(seats.map(seat => seat.id), ['explainer.window', 'explainer.file-context', 'explainer.quick'])
  assert.equal(seats[0].order, 520)
  assert.equal(seats[1].order, 500)
  assert.equal(seats[2].order, 260)
  assert.equal(appended.length, 1, 'the stylesheet is injected exactly once')
  assert.equal(typeof appended[0].textContent, 'string')
  assert.match(appended[0].textContent, /\.dx-card/)
  // The optional HTML renderer declares its own extension points; this
  // fixture context offers none, so the plugin must still load cleanly.
  assert.ok(effects.length >= 2, 'the stylesheet and locale contributions are disposed with the fiber')
})