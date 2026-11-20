/**
 * Strict headers for the local dashboard. Scripts come only from the server
 * itself; the only remote connections are the ones the dashboard needs
 * (local server, local Ollama, and provider APIs the user configures).
 */
export function securityHeaders(
  options: { connectSrc?: string[]; dev?: boolean } = {},
): Record<string, string> {
  const connect = [
    "'self'",
    'ws://127.0.0.1:*',
    'ws://localhost:*',
    'http://127.0.0.1:*',
    'http://localhost:*',
    ...(options.connectSrc ?? []),
  ]
  const script = options.dev ? ["'self'", "'unsafe-inline'"] : ["'self'", "'wasm-unsafe-eval'"]
  const csp = [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'no-store',
  }
}
