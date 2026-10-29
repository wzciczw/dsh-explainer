import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const preview = readFileSync(new URL('../src/client/html-preview.tsx', import.meta.url), 'utf8')
const registration = readFileSync(new URL('../src/client/html-registration.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')

test('the default HTML renderer keeps the opaque sandbox', () => {
  assert.match(preview, /sandbox="allow-scripts allow-popups allow-downloads allow-modals"/)
  assert.doesNotMatch(preview, /allow-same-origin/)
  assert.doesNotMatch(preview, /allow-top-navigation/)
})

test('it is registered as the automatic HTML implementation', () => {
  assert.match(registration, /priority: 'extension'/)
  assert.match(registration, /extensions: \['html', 'htm'\]/)
})

test('the file renders from a revocable blob and the bridge subscribes before load', () => {
  assert.match(preview, /URL\.createObjectURL/)
  assert.match(preview, /URL\.revokeObjectURL/)
  assert.match(preview, /bindHtmlBridge/)
})

test('the frame fills the sidebar body instead of the 300x150 default', () => {
  assert.match(styles, /\.dx-html-frame\{[^}]*width:100%/)
  assert.match(styles, /\.dx-html-frame\{[^}]*height:100%/)
  assert.match(styles, /\.dx-html-frame\{[^}]*border:0/)
})

test('both right-sidebar surfaces are wired', () => {
  assert.match(registration, /documentPreviews/)
  assert.match(registration, /registerFileViewer/)
})
