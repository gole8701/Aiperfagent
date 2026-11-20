/**
 * USD per million tokens. Prices change; this table is a best-effort estimate
 * and the dashboard says so. Longest matching prefix wins; unknown models cost 0.
 */
export interface ModelPrice {
  input: number
  output: number
  cachedInput: number
}

const PRICES: [prefix: string, price: ModelPrice][] = [
  ['claude-opus-4', { input: 15, output: 75, cachedInput: 1.5 }],
  ['claude-sonnet-4', { input: 3, output: 15, cachedInput: 0.3 }],
  ['claude-haiku-4', { input: 1, output: 5, cachedInput: 0.1 }],
  ['claude-3-7-sonnet', { input: 3, output: 15, cachedInput: 0.3 }],
  ['claude-3-5-sonnet', { input: 3, output: 15, cachedInput: 0.3 }],
  ['claude-3-5-haiku', { input: 0.8, output: 4, cachedInput: 0.08 }],
  ['gpt-5-nano', { input: 0.05, output: 0.4, cachedInput: 0.005 }],
  ['gpt-5-mini', { input: 0.25, output: 2, cachedInput: 0.025 }],
  ['gpt-5', { input: 1.25, output: 10, cachedInput: 0.125 }],
  ['gpt-4.1-nano', { input: 0.1, output: 0.4, cachedInput: 0.025 }],
  ['gpt-4.1-mini', { input: 0.4, output: 1.6, cachedInput: 0.1 }],
  ['gpt-4.1', { input: 2, output: 8, cachedInput: 0.5 }],
  ['gpt-4o-mini', { input: 0.15, output: 0.6, cachedInput: 0.075 }],
  ['gpt-4o', { input: 2.5, output: 10, cachedInput: 1.25 }],
  ['o4-mini', { input: 1.1, output: 4.4, cachedInput: 0.275 }],
  ['o3-mini', { input: 1.1, output: 4.4, cachedInput: 0.55 }],
  ['o3', { input: 2, output: 8, cachedInput: 0.5 }],
  ['gemini-2.5-pro', { input: 1.25, output: 10, cachedInput: 0.31 }],
  ['gemini-2.5-flash-lite', { input: 0.1, output: 0.4, cachedInput: 0.025 }],
  ['gemini-2.5-flash', { input: 0.3, output: 2.5, cachedInput: 0.075 }],
  ['gemini-2.0-flash-lite', { input: 0.075, output: 0.3, cachedInput: 0.02 }],
  ['gemini-2.0-flash', { input: 0.1, output: 0.4, cachedInput: 0.025 }],
  ['deepseek-chat', { input: 0.27, output: 1.1, cachedInput: 0.07 }],
  ['deepseek-reasoner', { input: 0.55, output: 2.19, cachedInput: 0.14 }],
  ['mistral-large', { input: 2, output: 6, cachedInput: 2 }],
  ['mistral-small', { input: 0.1, output: 0.3, cachedInput: 0.1 }],
  ['llama-3.3-70b', { input: 0.59, output: 0.79, cachedInput: 0.59 }],
  ['llama-3.1-8b', { input: 0.05, output: 0.08, cachedInput: 0.05 }],
]

export function priceFor(model: string): ModelPrice | undefined {
  const name = model.toLowerCase().replace(/^.*\//, '')
  let best: [string, ModelPrice] | undefined
  for (const entry of PRICES)
    if (name.startsWith(entry[0]) && (!best || entry[0].length > best[0].length)) best = entry
  return best?.[1]
}

/** Local models (Ollama, LM Studio) cost nothing; unknown cloud models are reported as 0 rather than guessed. */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
  provider?: string,
): number {
  if (provider === 'ollama') return 0
  const price = priceFor(model)
  if (!price) return 0
  const billedInput = Math.max(0, inputTokens - cachedTokens)
  return (
    (billedInput * price.input + cachedTokens * price.cachedInput + outputTokens * price.output) /
    1_000_000
  )
}
