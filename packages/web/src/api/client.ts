import { IS_STATIC } from '../static/env'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hint?: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const TOKEN_KEY = 'perfagent.token'

/** The token arrives once in the URL printed by the CLI and lives in sessionStorage afterwards. */
export function sessionToken(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('token')
  if (fromUrl) {
    sessionStorage.setItem(TOKEN_KEY, fromUrl)
    const clean = new URL(window.location.href)
    clean.searchParams.delete('token')
    window.history.replaceState(null, '', clean.toString())
    return fromUrl
  }
  return sessionStorage.getItem(TOKEN_KEY) ?? ''
}

interface RequestOptions {
  body?: unknown
  rawBody?: BodyInit
  headers?: Record<string, string>
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  if (IS_STATIC) throw new ApiError('This needs the installed tool.', 'NOT_LOCAL_MODE', 'Run "npx perfagent" in your project to use this feature.')
  const headers: Record<string, string> = { Authorization: `Bearer ${sessionToken()}`, ...options.headers }
  let body: BodyInit | undefined = options.rawBody
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }
  let response: Response
  try {
    response = await fetch(path, { method, headers, body })
  } catch {
    throw new ApiError('Cannot reach the PerfAgent server.', 'NETWORK', 'Is "npx perfagent" still running in your terminal?')
  }
  const text = await response.text()
  const data: unknown = text ? safeJson(text) : {}
  if (!response.ok) {
    const err = (data ?? {}) as { error?: string; code?: string; hint?: string }
    throw new ApiError(err.error ?? `Request failed (${response.status})`, err.code ?? 'HTTP', err.hint, response.status)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: Blob, filename: string) =>
    request<T>('POST', path, { rawBody: file, headers: { 'X-Filename': encodeURIComponent(filename), 'Content-Type': 'application/octet-stream' } }),
  /** Downloads an authenticated file (exports) through a blob URL so the token never lands in a link. */
  download: async (path: string, filename: string): Promise<void> => {
    const response = await fetch(path, { headers: { Authorization: `Bearer ${sessionToken()}` } })
    if (!response.ok) throw new ApiError('Export failed', 'HTTP', undefined, response.status)
    saveBlob(await response.blob(), filename)
  },
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function describeError(error: unknown): { message: string; hint?: string } {
  if (error instanceof ApiError) return { message: error.message, hint: error.hint }
  if (error instanceof Error) return { message: error.message }
  return { message: 'Something went wrong' }
}
