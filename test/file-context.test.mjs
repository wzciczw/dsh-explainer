import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { htmlToText, readFileContext } from '../lib/host/files.js'

test('HTML context is reduced to readable text, never markup', () => {
  const html = htmlToText('<html><head><style>p{color:red}</style></head><body>'
    + '<script>alert(1)</script><h1>标题</h1><p>正文&amp;说明</p><ul><li>一</li><li>二</li></ul></body></html>')
  assert.doesNotMatch(html, /<[a-z/]/i)
  assert.doesNotMatch(html, /alert\(1\)/)
  assert.doesNotMatch(html, /color:red/)
  assert.match(html, /标题/)
  assert.match(html, /正文&说明/)
})

test('an HTML file contributes its words, not its tags, to the ask context', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'explainer-html-'))
  const file = join(directory, 'report.html')
  await writeFile(file, '<!doctype html><html><body><h1>报告</h1><p>结论在这里。</p>'
    + '<script>window.x=1</script></body></html>', 'utf8')
  const context = await readFileContext(directory, file, 4000)
  assert.match(context, /结论在这里/)
  assert.doesNotMatch(context, /<h1>|window\.x/)
})

test('paths outside the workspace are refused', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'explainer-html-'))
  const outside = await mkdtemp(join(tmpdir(), 'explainer-out-'))
  const file = join(outside, 'secret.html')
  await writeFile(file, '<p>top secret</p>', 'utf8')
  assert.equal(await readFileContext(directory, file, 4000), '')
})
