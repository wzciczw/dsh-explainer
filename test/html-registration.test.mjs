import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function loadModule() {
  let entry
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: (value) => { entry = value } } },
    document: { createElement: () => ({ setAttribute() {}, textContent: '', remove() {} }), head: { appendChild() {} } },
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    crypto: globalThis.crypto, fetch: () => Promise.reject(new Error('offline')), URL, TextDecoder, TextEncoder,
  })
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    memo: (c) => c, Fragment: 'F', useState: (v) => [v, () => {}], useEffect() {},
    useRef: () => ({ current: null }), useCallback: (f) => f, useSyncExternalStore: () => undefined, useMemo: (f) => f(),
  }
  return entry.factory((id) => {
    if (id === 'react') return react
    throw new Error(`unexpected require ${id}`)
  })
}

function services({ better, previews }) {
  const viewers = [{ id: 'html', component: () => null, exts: ['html'], priority: 0 }]
  const registered = { viewers: [], previews: [] }
  const seats = []
  const context = {
    slots: { inject: (key, fn) => { fn() }, register: (options) => { seats.push(options.id); return () => {} } },
    locale: { register: () => () => {}, bind: () => (key) => key },
    effect: (fn) => { fn() },
    inject: (names, fn) => fn({
      get: (name) => {
        if (name === 'betterSidebar') {
          if (!better) return undefined
          return {
            getFileViewers: () => viewers,
            registerFileViewer: (viewer) => { registered.viewers.push(viewer); return () => {} },
          }
        }
        if (!previews) return undefined
        return { register: (definition) => { registered.previews.push(definition); return () => {} } }
      },
      effect: (fn) => fn(),
      slots: context.slots,
    }),
  }
  return { context, registered, seats }
}

test('the core seats load with no optional preview service at all', () => {
  const { context, seats } = services({ better: false, previews: false })
  loadModule().apply(context)
  assert.equal(seats.join(','), 'explainer.window,explainer.file-context,explainer.quick')
})

test('the HTML viewer is registered for the right-sidebar editor too', () => {
  const { context, registered } = services({ better: true, previews: false })
  loadModule().apply(context)
  assert.equal(registered.viewers.length, 1)
  const viewer = registered.viewers[0]
  assert.equal(viewer.exts.join(','), 'html,htm')
  assert.ok(viewer.priority > 0, 'the bridge viewer wins the HTML match')
})

test('the native renderer is the automatic HTML implementation', () => {
  const { context, registered } = services({ better: false, previews: true })
  loadModule().apply(context)
  assert.equal(registered.previews.length, 1)
  assert.equal(registered.previews[0].priority, 'extension')
})
