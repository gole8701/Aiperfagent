import { randomBytes, timingSafeEqual } from 'node:crypto'

/** A fresh token per server start, like Jupyter. 32 bytes → 43 URL-safe chars. */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenMatches(expected: string, given: string | undefined): boolean {
  if (!given || given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given))
}

/** Reads the token from `Authorization: Bearer …`, the `?token=` query or the session cookie. */
export function extractToken(
  headers: Record<string, string | string[] | undefined>,
  url: string,
): string | undefined {
  const auth = headerValue(headers.authorization)
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const query = new URL(url, 'http://127.0.0.1').searchParams.get('token')
  if (query) return query
  const cookie = headerValue(headers.cookie)
  const match = cookie ? /(?:^|;\s*)perfagent_token=([^;]+)/.exec(cookie) : null
  return match?.[1]
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
