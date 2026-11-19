/**
 * Strips secrets from anything that gets stored, displayed, exported or sent
 * to an AI. Runs on strings and recursively on objects.
 */
const SECRET_HEADER_NAMES = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token', 'proxy-authorization', 'x-csrf-token', 'x-xsrf-token'])

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(sk|pk|rk)-(?:[a-z0-9]+-)?[A-Za-z0-9_-]{16,}\b/g, label: 'api-key' }, // OpenAI, Anthropic, Stripe-style keys
  { re: /\bAKIA[0-9A-Z]{16}\b/g, label: 'aws-key' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, label: 'github-token' },
  { re: /\bAIza[0-9A-Za-z_-]{30,}\b/g, label: 'google-key' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, label: 'slack-token' },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, label: 'jwt' },
  { re: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, label: 'auth-header' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, label: 'private-key' },
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, label: 'email' },
  { re: /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["']?([^"'\s,;]{6,})/gi, label: 'kv-secret' },
]

export function redactText(input: string): string {
  let out = input
  for (const { re, label } of PATTERNS) {
    out = out.replace(re, (match: string, ...groups: unknown[]) => {
      if (label === 'kv-secret' && typeof groups[0] === 'string') return match.replace(groups[0], `[redacted ${label}]`)
      return `[redacted ${label}]`
    })
  }
  return out
}

/** Also strips query-string secrets like `?token=…`, `?key=…`, `?sig=…`. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    for (const key of [...u.searchParams.keys()]) {
      if (/^(token|key|api_?key|secret|sig|signature|auth|session|password|access_token|refresh_token)$/i.test(key)) u.searchParams.set(key, 'redacted')
    }
    return u.toString()
  } catch {
    return redactText(url)
  }
}

export function redactHeaders<T extends Record<string, unknown>>(headers: T): T {
  const out: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SECRET_HEADER_NAMES.has(name.toLowerCase()) ? '[redacted]' : typeof value === 'string' ? redactText(value) : value
  }
  return out as T
}

export function redact<T>(value: T): T {
  return walk(value, 0) as T
}

function walk(value: unknown, depth: number): unknown {
  if (depth > 40) return value
  if (typeof value === 'string') return value.length > 200_000 ? value : redactText(value)
  if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1))
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) {
      const lower = key.toLowerCase()
      if (SECRET_HEADER_NAMES.has(lower) || /^(password|secret|apikey|api_key|token|cookie)s?$/.test(lower)) out[key] = '[redacted]'
      else if (lower === 'headers' && typeof v === 'object' && v !== null) out[key] = redactHeaders(v as Record<string, unknown>)
      else if ((lower === 'url' || lower === 'href') && typeof v === 'string') out[key] = redactUrl(v)
      else out[key] = walk(v, depth + 1)
    }
    return out
  }
  return value
}
