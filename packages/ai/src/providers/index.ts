import { anthropic } from './anthropic.js'
import { claudeCode, codex, geminiCli } from './cli.js'
import { gemini } from './gemini.js'
import { ollama } from './ollama.js'
import { lmstudio, openai, openaiCompatible, openrouter } from './openai.js'
import type { Provider, ProviderId } from './types.js'

export const PROVIDERS: Record<Exclude<ProviderId, 'browser'>, Provider> = {
  ollama,
  anthropic,
  openai,
  'openai-compatible': openaiCompatible,
  gemini,
  lmstudio,
  openrouter,
  'claude-code': claudeCode,
  codex,
  'gemini-cli': geminiCli,
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
export { CLI_BINS, cliInstalled } from './cli.js'
export { LMSTUDIO_URL, OPENROUTER_URL } from './openai.js'
