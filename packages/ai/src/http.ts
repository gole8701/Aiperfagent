import { PerfAgentError } from '@perfagent/core'

const MAX_ATTEMPTS = 3

/**
 * `fetch` with a timeout and up to 3 attempts on 429/5xx. Honours `retry-after`,
 * otherwise exponential backoff with jitter. Network errors are retried too.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (response.ok || !RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS)
        return response
      await sleep(retryDelay(response.headers.get('retry-after'), attempt))
      await response.body?.cancel().catch(() => undefined)
      continue
    } catch (error) {
      lastError = error
      if (attempt === MAX_ATTEMPTS) break
      await sleep(retryDelay(null, attempt))
    }
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError)
  throw new PerfAgentError(
    'AI_REQUEST_FAILED',
    `Could not reach ${new URL(url).host}: ${reason}`,
    'Check the endpoint, your network and that the service is running.',
  )
}

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529])

function retryDelay(retryAfter: string | null, attempt: number): number {
  const header = retryAfter ? Number(retryAfter) : NaN
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 30_000)
  return 500 * 2 ** (attempt - 1) + Math.random() * 250
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Reads a streamed body line by line (SSE `data:` lines or NDJSON). */
export async function* readLines(response: Response): AsyncGenerator<string> {
  if (!response.body) return
  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      yield buffer.slice(0, index).trimEnd()
      buffer = buffer.slice(index + 1)
      index = buffer.indexOf('\n')
    }
  }
  if (buffer.trim()) yield buffer.trim()
}

/** Turns a non-OK response into a PerfAgentError without leaking the request (and its key). */
export async function failedResponse(
  response: Response,
  provider: string,
): Promise<PerfAgentError> {
  const text = (await response.text().catch(() => '')).slice(0, 300)
  const hint =
    response.status === 401 || response.status === 403
      ? 'Check the API key in Profile → AI connections.'
      : response.status === 429
        ? 'The provider is rate-limiting you; try again in a moment.'
        : undefined
  return new PerfAgentError(
    'AI_REQUEST_FAILED',
    `${provider} answered ${response.status}${text ? `: ${text}` : ''}`,
    hint,
  )
}

/** Parses a JSON body or throws a typed error. */
export async function readJson<T>(response: Response, provider: string): Promise<T> {
  if (!response.ok) throw await failedResponse(response, provider)
  return (await response.json()) as T
}
