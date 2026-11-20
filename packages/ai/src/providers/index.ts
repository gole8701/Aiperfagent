import { anthropic } from './anthropic.js'
import { gemini } from './gemini.js'
import { ollama } from './ollama.js'
import { openai, openaiCompatible } from './openai.js'
import type { Provider, ProviderId } from './types.js'

export const PROVIDERS: Record<Exclude<ProviderId, 'browser'>, Provider> = {
  ollama,
  anthropic,
  openai,
  'openai-compatible': openaiCompatible,
  gemini,
}

export function providerById(id: ProviderId): Provider | undefined {
  return id === 'browser' ? undefined : PROVIDERS[id]
}

export type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  Provider,
  ProviderAuth,
  ProviderId,
} from './types.js'
export {
  OLLAMA_URL,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_INSTALL_HINT,
  ollamaModels,
  pullModel,
} from './ollama.js'
