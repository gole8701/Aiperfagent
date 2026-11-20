import { fetchWithRetry, failedResponse, readJson, readLines } from '../http.js'

import {
  pingProvider,
  type ChatRequest,
  type ChatResult,
  type Provider,
  type ProviderAuth,
} from './types.js'

export const OLLAMA_URL = 'http://127.0.0.1:11434'
export const OLLAMA_DEFAULT_MODEL = 'qwen2.5-coder:7b'
export const OLLAMA_INSTALL_HINT =
  process.platform === 'darwin'
    ? `Download Ollama from https://ollama.com/download/mac, then run: ollama pull ${OLLAMA_DEFAULT_MODEL}`
    : `curl -fsSL https://ollama.com/install.sh | sh && ollama pull ${OLLAMA_DEFAULT_MODEL}`
// Small local models on a laptop can take minutes for a long answer.
const LOCAL_CHAT_TIMEOUT_MS = 600_000

interface OllamaChunk {
  model: string
  message?: { content?: string }
  done?: boolean
  prompt_eval_count?: number
  eval_count?: number
}

async function chat(request: ChatRequest, auth: ProviderAuth): Promise<ChatResult> {
  const started = Date.now()
  const base = (auth.baseUrl ?? OLLAMA_URL).replace(/\/$/, '')
  const payload = {
    model: request.model,
    messages: [{ role: 'system', content: request.system }, ...request.messages],
    stream: request.stream === true,
    options: { num_predict: request.maxTokens },
  }
  const response = await fetchWithRetry(
    `${base}/api/chat`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    LOCAL_CHAT_TIMEOUT_MS,
  )
  if (!request.stream) {
    const data = await readJson<OllamaChunk>(response, 'Ollama')
    const totalMs = Date.now() - started
    return {
      text: data.message?.content ?? '',
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      cachedTokens: 0,
      firstTokenMs: totalMs,
      totalMs,
      model: data.model,
    }
  }
  if (!response.ok) throw await failedResponse(response, 'Ollama')
  let text = ''
  let firstTokenMs = 0
  let last: OllamaChunk = { model: request.model }
  for await (const line of readLines(response)) {
    if (!line) continue
    last = JSON.parse(line) as OllamaChunk
    const delta = last.message?.content
    if (delta) {
      if (!firstTokenMs) firstTokenMs = Date.now() - started
      text += delta
    }
  }
  const totalMs = Date.now() - started
  return {
    text,
    inputTokens: last.prompt_eval_count ?? 0,
    outputTokens: last.eval_count ?? 0,
    cachedTokens: 0,
    firstTokenMs: firstTokenMs || totalMs,
    totalMs,
    model: last.model,
  }
}

/** Returns the installed model names, or `undefined` when Ollama is not running. */
export async function ollamaModels(baseUrl = OLLAMA_URL): Promise<string[] | undefined> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) return undefined
    const data = (await response.json()) as { models?: { name: string }[] }
    return (data.models ?? []).map((m) => m.name)
  } catch {
    return undefined
  }
}

/** "Install free local AI": pulls a model and reports progress (0–1). Resolves when the pull finishes. */
export async function pullModel(
  model: string,
  onProgress: (fraction: number, status: string) => void,
  baseUrl = OLLAMA_URL,
): Promise<void> {
  const response = await fetchWithRetry(
    `${baseUrl.replace(/\/$/, '')}/api/pull`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
    },
    60 * 60_000,
  )
  if (!response.ok) throw await failedResponse(response, 'Ollama')
  for await (const line of readLines(response)) {
    if (!line) continue
    const chunk = JSON.parse(line) as {
      status?: string
      total?: number
      completed?: number
      error?: string
    }
    if (chunk.error) throw new Error(chunk.error)
    onProgress(
      chunk.total && chunk.completed ? chunk.completed / chunk.total : 0,
      chunk.status ?? '',
    )
  }
}

export const ollama: Provider = {
  id: 'ollama',
  label: 'Local AI (Ollama)',
  free: true,
  defaultModel: OLLAMA_DEFAULT_MODEL,
  chat,
  listModels: async (auth) => (await ollamaModels(auth.baseUrl)) ?? [],
  test: async (auth, model) => {
    const models = await ollamaModels(auth.baseUrl)
    if (!models)
      return { ok: false, message: 'Ollama is not running on this machine.', latencyMs: 0 }
    const pick = model ?? models.find((m) => m.startsWith('qwen2.5-coder')) ?? models[0]
    if (!pick)
      return {
        ok: false,
        message: `Ollama runs but has no models. Run: ollama pull ${OLLAMA_DEFAULT_MODEL}`,
        latencyMs: 0,
      }
    return pingProvider(ollama, auth, pick)
  },
}
