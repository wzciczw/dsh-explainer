import assert from 'node:assert/strict'
import test from 'node:test'
import { composeOpening, defaultInstruction, selectionShape } from '../lib/host/prompt.js'
import { loadBundleModule } from './bundle-modules.mjs'

const client = loadBundleModule('selection')

test('English prose is translated first', () => {
  assert.equal(selectionShape('The cost of a branch is mostly in merging, not in creating it.'), 'english-prose')
  assert.equal(selectionShape('Create a fork when you want to try an idea without touching main'), 'english-prose')
  const text = composeOpening({
    selection: 'The cost of a branch is mostly in merging, not in creating it.',
    question: '', context: '', files: '', file: '',
  })
  assert.match(text, /翻译成中文/)
  assert.doesNotMatch(text, /请解释这段文字/)
})

test('a lone term is explained, not translated', () => {
  for (const term of [
    'LayerFS', 'branch', 'three-way merge', 'fork', 'Observability',
    // The term with a couple of filler words around it is still the term.
    'the concept of observability', 'The notion of a branch',
    'observability platform for multi-agent systems',
    'LayerFS (a layered file system)', 'The cost of a branch',
    'LayerFS 的概念', '什么是 LayerFS',
  ]) {
    assert.equal(selectionShape(term), 'term', term)
  }
  const text = composeOpening({ selection: 'LayerFS', question: '', context: '', files: '', file: '' })
  assert.match(text, /解释这个术语/)
  assert.doesNotMatch(text, /翻译/)
})

test('a real question is answered, not translated', () => {
  for (const question of ['Why is a branch cheap?', 'How do branches merge?', 'What changed in 2026?']) {
    assert.equal(selectionShape(question), 'question', question)
  }
  const text = composeOpening({ selection: 'Why is a branch cheap?', question: '', context: '', files: '', file: '' })
  assert.match(text, /直接回答选中的问题/)
})

test('the browser classifier agrees with the host on every sample', () => {
  const samples = [
    'The cost of a branch is mostly in merging, not in creating it.',
    'Create a fork when you want to try an idea without touching main',
    'the concept of observability',
    'observability platform for multi-agent systems',
    'LayerFS (a layered file system)',
    'The cost of a branch',
    'A branch is cheap',
    'Why is a branch cheap?',
    'What is LayerFS?',
    'merge conflict',
    'how branches merge',
    'LayerFS',
    '创建分支几乎不花钱',
    'const x = foo(1)',
  ]
  for (const sample of samples) assert.equal(client.selectionShape(sample), selectionShape(sample), sample)
})

test('Chinese text and code keep the explaining default', () => {
  assert.equal(selectionShape('创建分支几乎不花钱，贵的是合并'), 'other')
  assert.equal(selectionShape('const x = foo(1)'), 'other')
  assert.equal(selectionShape(''), 'other')
  const text = composeOpening({ selection: '创建分支几乎不花钱，贵的是合并', question: '', context: '', files: '', file: '' })
  assert.match(text, /请解释这段文字/)
})

test('a typed question always wins over the default shape', () => {
  const text = composeOpening({
    selection: 'The cost of a branch is mostly in merging.', question: '这句话重点是什么？', context: '', files: '', file: '',
  })
  assert.match(text, /这句话重点是什么/)
  assert.doesNotMatch(text, /先把这段英文完整翻译/)
})

test('defaultInstruction is stable per shape', () => {
  assert.match(defaultInstruction('english-prose'), /翻译/)
  assert.match(defaultInstruction('term'), /术语/)
  assert.match(defaultInstruction('other'), /解释/)
})
