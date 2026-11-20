import { PerfAgentError } from '@perfagent/core'

import { fetchWithRetry, failedResponse, readJson, readLines } from '../http.js'

import { CHAT_TIMEOUT_MS, LIST_TIMEOUT_MS, pingProvider, type ChatRequest, type ChatResult, type Provider, type ProviderAuth } from './types.js'

const DEFAULT_URL = 'https://api.anthropic.com'
const VERSION = '2023-06-01'

interface Usage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
}

interface MessageResponse {
  model: string
  content: { type: string; text?: string }[]
  usage: Usage
}

function headers(auth: ProviderAuth): Record<string, string> {
  if (!auth.apiKey) throw new PerfAgentError('AI_NOT_CONFIGURED', 'No Anthropic key', 'Add it in Profile → AI connections or set ANTHROPIC_API_KEY.')
  return { 'content-type': 'application/json', 'x-api-key': auth.apiKey, 'anthropic-version': VERSION }
}

function body(request: ChatRequest): string {
  return JSON.stringify({
    model: request.model,
    max_tokens: request.maxTokens,
    // The system prompt is the stable part of every call, so it is the part worth caching.
    system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
    messages: request.messages,
    stream: request.stream === true,
  })
}

async function chat(request: ChatRequest, auth: ProviderAuth): Promise<ChatResult> {
  const started = Date.now()
  const base = auth.baseUrl ?? DEFAULT_URL
  const response = await fetchWithRetry(`${base}/v1/messages`, { method: 'POST', headers: headers(auth), body: body(request) }, CHAT_TIMEOUT_MS)
  if (!request.stream) {
    const data = await readJson<MessageResponse>(response, 'Anthropic')
    const totalMs = Date.now() - started
    return { text: data.content.map((c) => c.text ?? '').join(''), ...tokens(data.usage), firstTokenMs: totalMs, totalMs, model: data.model }
  }
  if (!response.ok) throw await failedResponse(response, 'Anthropic')
  let text = ''
  let firstTokenMs = 0
  let model = request.model
  let usage: Usage = {}
  for await (const line of readLines(response)) {
    if (!line.startsWith('data:')) continue
    const event = JSON.parse(line.slice(5)) as { type: string; message?: { model: string; usage: Usage }; delta?: { text?: string }; usage?: Usage }
    if (event.type === 'message_start' && event.message) {
      model = event.message.model
      usage = event.message.usage
    } else if (event.type === 'content_block_delta' && event.delta?.text) {
      if (!firstTokenMs) firstTokenMs = Date.now() - started
      text += event.delta.text
    } else if (event.type === 'message_delta' && event.usage) usage = { ...usage, ...event.usage }
  }
  const totalMs = Date.now() - started
  return { text, ...tokens(usage), firstTokenMs: firstTokenMs || totalMs, totalMs, model }
}

function tokens(usage: Usage): Pick<ChatResult, 'inputTokens' | 'outputTokens' | 'cachedTokens'> {
  return { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0, cachedTokens: usage.cache_read_input_tokens ?? 0 }
}

async function listModels(auth: ProviderAuth): Promise<string[]> {
  const response = await fetchWithRetry(`${auth.baseUrl ?? DEFAULT_URL}/v1/models?limit=100`, { headers: headers(auth) }, LIST_TIMEOUT_MS)
  const data = await readJson<{ data: { id: string }[] }>(response, 'Anthropic')
  return data.data.map((m) => m.id)
}

export const anthropic: Provider = {
  id: 'anthropic',
  label: 'Claude (Anthropic)',
  free: false,
  defaultModel: 'claude-sonnet-4-5',
  chat,
  listModels,
  test: (auth, model) => pingProvider(anthropic, auth, model ?? anthropic.defaultModel),
}
