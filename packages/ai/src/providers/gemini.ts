import { PerfAgentError } from '@perfagent/core'

import { fetchWithRetry, failedResponse, readJson, readLines } from '../http.js'

import { CHAT_TIMEOUT_MS, LIST_TIMEOUT_MS, pingProvider, type ChatRequest, type ChatResult, type Provider, type ProviderAuth } from './types.js'

const DEFAULT_URL = 'https://generativelanguage.googleapis.com/v1beta'

interface UsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  cachedContentTokenCount?: number
}

interface GenerateResponse {
  modelVersion?: string
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  usageMetadata?: UsageMetadata
}

function key(auth: ProviderAuth): string {
  if (!auth.apiKey) throw new PerfAgentError('AI_NOT_CONFIGURED', 'No Gemini key', 'Add it in Profile → AI connections or set GEMINI_API_KEY.')
  return auth.apiKey
}

function textOf(data: GenerateResponse): string {
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
}

function tokens(usage: UsageMetadata | undefined): Pick<ChatResult, 'inputTokens' | 'outputTokens' | 'cachedTokens'> {
  return { inputTokens: usage?.promptTokenCount ?? 0, outputTokens: usage?.candidatesTokenCount ?? 0, cachedTokens: usage?.cachedContentTokenCount ?? 0 }
}

async function chat(request: ChatRequest, auth: ProviderAuth): Promise<ChatResult> {
  const started = Date.now()
  const base = (auth.baseUrl ?? DEFAULT_URL).replace(/\/$/, '')
  const method = request.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  const payload = {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: request.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: request.maxTokens },
  }
  // The key goes in a header, never in the URL, so it cannot end up in logs.
  const response = await fetchWithRetry(`${base}/models/${encodeURIComponent(request.model)}:${method}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key(auth) }, body: JSON.stringify(payload) }, CHAT_TIMEOUT_MS)
  if (!request.stream) {
    const data = await readJson<GenerateResponse>(response, 'Gemini')
    const totalMs = Date.now() - started
    return { text: textOf(data), ...tokens(data.usageMetadata), firstTokenMs: totalMs, totalMs, model: data.modelVersion ?? request.model }
  }
  if (!response.ok) throw await failedResponse(response, 'Gemini')
  let text = ''
  let firstTokenMs = 0
  let last: GenerateResponse = {}
  for await (const line of readLines(response)) {
    if (!line.startsWith('data:')) continue
    last = JSON.parse(line.slice(5)) as GenerateResponse
    const delta = textOf(last)
    if (delta && !firstTokenMs) firstTokenMs = Date.now() - started
    text += delta
  }
  const totalMs = Date.now() - started
  return { text, ...tokens(last.usageMetadata), firstTokenMs: firstTokenMs || totalMs, totalMs, model: last.modelVersion ?? request.model }
}

async function listModels(auth: ProviderAuth): Promise<string[]> {
  const base = (auth.baseUrl ?? DEFAULT_URL).replace(/\/$/, '')
  const response = await fetchWithRetry(`${base}/models?pageSize=100`, { headers: { 'x-goog-api-key': key(auth) } }, LIST_TIMEOUT_MS)
  const data = await readJson<{ models?: { name: string; supportedGenerationMethods?: string[] }[] }>(response, 'Gemini')
  return (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true).map((m) => m.name.replace(/^models\//, ''))
}

export const gemini: Provider = {
  id: 'gemini',
  label: 'Gemini (Google)',
  free: false,
  defaultModel: 'gemini-2.5-flash',
  chat,
  listModels,
  test: (auth, model) => pingProvider(gemini, auth, model ?? gemini.defaultModel),
}
