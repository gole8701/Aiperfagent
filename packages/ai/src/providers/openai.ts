import { PerfAgentError } from '@perfagent/core'

import { fetchWithRetry, failedResponse, readJson, readLines } from '../http.js'

import {
  CHAT_TIMEOUT_MS,
  LIST_TIMEOUT_MS,
  pingProvider,
  type ChatRequest,
  type ChatResult,
  type Provider,
  type ProviderAuth,
  type ProviderId,
} from './types.js'

const DEFAULT_URL = 'https://api.openai.com/v1'

interface Usage {
  prompt_tokens?: number
  completion_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
}

interface ChatCompletion {
  model: string
  choices: { message?: { content?: string | null }; delta?: { content?: string | null } }[]
  usage?: Usage
}

function headers(auth: ProviderAuth, id: ProviderId): Record<string, string> {
  // Local OpenAI-compatible servers (LM Studio, vLLM) often need no key; cloud ones always do.
  if (!auth.apiKey && (id === 'openai' || id === 'openrouter'))
    throw new PerfAgentError(
      'AI_NOT_CONFIGURED',
      id === 'openai' ? 'No OpenAI key' : 'OpenRouter is not connected',
      id === 'openai'
        ? 'Add it in Settings → AI connections or set OPENAI_API_KEY.'
        : 'Click "Connect with OpenRouter" in Settings → AI connections.',
    )
  const out: Record<string, string> = { 'content-type': 'application/json' }
  if (auth.apiKey) {
    out.authorization = `Bearer ${auth.apiKey}`
    out['api-key'] = auth.apiKey // Azure OpenAI reads this header instead
  }
  return out
}

/** Chat Completions is the one API every OpenAI-compatible server speaks (Azure, Groq, OpenRouter, DeepSeek, Mistral, LM Studio…). */
function compatible(
  id: ProviderId,
  label: string,
  defaultModel: string,
  defaultUrl = DEFAULT_URL,
): Provider {
  async function chat(request: ChatRequest, auth: ProviderAuth): Promise<ChatResult> {
    const started = Date.now()
    const base = (auth.baseUrl ?? defaultUrl).replace(/\/$/, '')
    const payload = {
      model: request.model,
      max_tokens: request.maxTokens,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      stream: request.stream === true,
      ...(request.stream ? { stream_options: { include_usage: true } } : {}),
    }
    const response = await fetchWithRetry(
      `${base}/chat/completions`,
      { method: 'POST', headers: headers(auth, id), body: JSON.stringify(payload) },
      CHAT_TIMEOUT_MS,
    )
    if (!request.stream) {
      const data = await readJson<ChatCompletion>(response, label)
      const totalMs = Date.now() - started
      return {
        text: data.choices[0]?.message?.content ?? '',
        ...tokens(data.usage),
        firstTokenMs: totalMs,
        totalMs,
        model: data.model,
      }
    }
    if (!response.ok) throw await failedResponse(response, label)
    let text = ''
    let firstTokenMs = 0
    let model = request.model
    let usage: Usage | undefined
    for await (const line of readLines(response)) {
      if (!line.startsWith('data:') || line.includes('[DONE]')) continue
      const chunk = JSON.parse(line.slice(5)) as ChatCompletion
      model = chunk.model || model
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        if (!firstTokenMs) firstTokenMs = Date.now() - started
        text += delta
      }
      if (chunk.usage) usage = chunk.usage
    }
    const totalMs = Date.now() - started
    return { text, ...tokens(usage), firstTokenMs: firstTokenMs || totalMs, totalMs, model }
  }

  async function listModels(auth: ProviderAuth): Promise<string[]> {
    const base = (auth.baseUrl ?? defaultUrl).replace(/\/$/, '')
    const response = await fetchWithRetry(
      `${base}/models`,
      { headers: headers(auth, id) },
      LIST_TIMEOUT_MS,
    )
    const data = await readJson<{ data: { id: string }[] }>(response, label)
    return data.data.map((m) => m.id).sort()
  }

  const provider: Provider = {
    id,
    label,
    free: false,
    defaultModel,
    chat,
    listModels,
    test: (auth, model) => pingProvider(provider, auth, model ?? defaultModel),
  }
  return provider
}

function tokens(
  usage: Usage | undefined,
): Pick<ChatResult, 'inputTokens' | 'outputTokens' | 'cachedTokens'> {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
  }
}

export const openai = compatible('openai', 'OpenAI', 'gpt-4.1-mini')
export const openaiCompatible = compatible('openai-compatible', 'OpenAI-compatible endpoint', '')
export const LMSTUDIO_URL = 'http://127.0.0.1:1234/v1'
export const lmstudio: Provider = {
  ...compatible('lmstudio', 'Local AI (LM Studio)', '', LMSTUDIO_URL),
  free: true,
}
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1'
export const openrouter = compatible('openrouter', 'OpenRouter', 'openrouter/auto', OPENROUTER_URL)
