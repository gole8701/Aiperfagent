import type { ProviderStatus } from '@perfagent/engine'

export type ProviderId = ProviderStatus['id']

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  system: string
  messages: ChatMessage[]
  maxTokens: number
  model: string
  /** Stream to measure the first token; the full text is still returned. */
  stream?: boolean
}

export interface ChatResult {
  text: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  firstTokenMs: number
  totalMs: number
  model: string
}

export interface ProviderAuth {
  apiKey?: string
  baseUrl?: string
}

export interface Provider {
  id: ProviderId
  label: string
  free: boolean
  defaultModel: string
  chat(request: ChatRequest, auth: ProviderAuth): Promise<ChatResult>
  listModels(auth: ProviderAuth): Promise<string[]>
  test(auth: ProviderAuth, model?: string): Promise<{ ok: boolean; message: string; latencyMs: number }>
}

export const CHAT_TIMEOUT_MS = 120_000
export const LIST_TIMEOUT_MS = 8_000

/** Shared "say hi" check: one tiny completion proves key, endpoint and model at once. */
export async function pingProvider(provider: Provider, auth: ProviderAuth, model: string): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const started = Date.now()
  try {
    const result = await provider.chat({ system: 'Reply with the single word OK.', messages: [{ role: 'user', content: 'ping' }], maxTokens: 8, model }, auth)
    return { ok: true, message: `${provider.label} answered with ${result.model} in ${result.totalMs} ms`, latencyMs: Date.now() - started }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - started }
  }
}
