import assert from 'node:assert/strict'
import test from 'node:test'
import { loadBundleModule } from './bundle-modules.mjs'

const { buildBridgeDocument, previewIdentity, MAX_HTML_CHARS } = loadBundleModule('html-bridge')

test('the file keeps its own rendering and gets exactly one bridge script', () => {
  const html = buildBridgeDocument(
    '<!doctype html><html><body><h1>报告</h1><script>window.x = 1</script></body></html>',
    'a'.repeat(32),
  )
  assert.match(html, /<h1>报告<\/h1>/, 'the report markup survives')
  assert.match(html, /window\.x = 1/, 'the report script survives')
  assert.equal(html.match(/dsh-explainer\/html-selection\/v1/g)?.length, 1)
  assert.ok(html.indexOf('window.x = 1') < html.indexOf('dsh-explainer/html-selection/v1'), 'the bridge runs after the page')
})

test('a document without a body still gets the bridge', () => {
  const html = buildBridgeDocument('<p>hi</p>', 'b'.repeat(32))
  assert.match(html, /<p>hi<\/p>/)
  assert.match(html, /dsh-explainer\/html-selection\/v1/)
})

test('huge files and forged channels are refused', () => {
  assert.throws(() => buildBridgeDocument('x'.repeat(MAX_HTML_CHARS + 1), 'a'.repeat(32)))
  assert.throws(() => buildBridgeDocument('<p>x</p>', 'nope'))
})

test('each document gets a fresh identity', () => {
  assert.equal(previewIdentity().length, 48)
  assert.notEqual(previewIdentity(), previewIdentity())
})
