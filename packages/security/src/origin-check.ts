/**
 * Blocks "a malicious web page talks to your localhost" (CSRF, DNS rebinding).
 * Only requests whose Host is the loopback address we listen on, and whose
 * Origin (when present) is that same address, get through.
 */
export interface OriginPolicy {
  port: number
  /** Extra origins allowed, e.g. the Vite dev server during development. */
  extraOrigins?: string[]
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

export function hostAllowed(host: string | undefined, policy: OriginPolicy): boolean {
  if (!host) return false
  const { hostname, port } = splitHost(host)
  return LOOPBACK_HOSTS.has(hostname) && (port === policy.port || port === undefined)
}

export function originAllowed(origin: string | undefined, policy: OriginPolicy): boolean {
  if (origin === undefined || origin === 'null') return origin === undefined
  if (policy.extraOrigins?.includes(origin)) return true
  try {
    const url = new URL(origin)
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
    return (
      LOOPBACK_HOSTS.has(url.hostname === '::1' ? '[::1]' : url.hostname) && port === policy.port
    )
  } catch {
    return false
  }
}

/** Full check for one request. `null` means allowed, otherwise the reason. */
export function requestRejection(
  headers: { host?: string; origin?: string; referer?: string; 'sec-fetch-site'?: string },
  policy: OriginPolicy,
): string | null {
  if (!hostAllowed(headers.host, policy)) return 'Host header is not the local dashboard address'
  if (!originAllowed(headers.origin, policy)) return 'Request came from another website'
  if (headers.origin === undefined && headers['sec-fetch-site'] === 'cross-site')
    return 'Cross-site request'
  return null
}

function splitHost(host: string): { hostname: string; port?: number } {
  const v6 = /^(\[[^\]]+\])(?::(\d+))?$/.exec(host)
  if (v6) return { hostname: v6[1] ?? '', port: v6[2] ? Number(v6[2]) : undefined }
  const [hostname = '', port] = host.split(':')
  return { hostname, port: port ? Number(port) : undefined }
}
