/**
 * Deterministic E2E model: registers a "fake" provider whose answer echoes the
 * last user message. Used only to verify the 快问 plugin end to end without an
 * API key.
 */
export const name = 'fake-llm'
export const inject = ['llm']

export function apply(ctx) {
  const reasoning = {
    efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }],
    defaultEffort: 'off',
  }
  const adapter = {
    providerInfo: (provider) => ({ id: provider, name: 'Fake' }),
    providerRetryPolicy: () => undefined,
    imageRequestPricing: () => undefined,
    imageRequestTarget: (provider, model, image) => ({ width: image.width, height: image.height, maxBytes: image.bytes }),
    listModels: async (provider) => [{ provider, id: 'fake', name: 'fake' }],
    resolveModel: async (provider, model) => ({ provider, id: model, name: model, reasoning }),
    async prepareCall(provider, model) {
      return {
        model: { provider, id: model, name: model, reasoning },
        stream: (options) => adapter.stream(options),
      }
    },
    async *stream(options) {
      const last = options.messages[options.messages.length - 1]
      const text = (last?.content ?? [])
        .map(block => (typeof block?.text === 'string' ? block.text : ''))
        .join(' ')
      const reply = `（fake）收到：${text.slice(0, 80)}`
      yield { type: 'text-delta', index: 0, text: reply }
      yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 2 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
  ctx.llm.registerAdapter(['fake'], adapter)
}