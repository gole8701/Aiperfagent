import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * For scans of URLs typed by a user on a shared/hosted instance: refuse
 * private networks and cloud metadata addresses so the scanner can't be used
 * to reach internal systems. Local mode allows localhost on purpose.
 */
export interface UrlPolicy {
  allowLoopback: boolean
}

export async function assertUrlAllowed(raw: string, policy: UrlPolicy): Promise<URL> {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs can be scanned')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
  for (const address of addresses) {
    if (isLoopback(address)) {
      if (!policy.allowLoopback) throw new Error('Local addresses cannot be scanned from here')
      continue
    }
    if (isPrivate(address)) throw new Error('Private network addresses cannot be scanned')
  }
  return url
}

export function isLoopback(ip: string): boolean {
  return ip.startsWith('127.') || ip === '::1' || ip === '0.0.0.0' || ip === '::'
}

export function isPrivate(ip: string): boolean {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase()
    return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:') && isPrivate(lower.slice(7))
  }
  const [a = 0, b = 0] = ip.split('.').map(Number)
  if (a === 10 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}
