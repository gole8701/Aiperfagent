import { lineText, loc, pageMetric, snippet, type Finding, type Rule } from '../engine.js'

const docs = { backoff: { label: 'MDN: WebSocket reconnect with backoff', url: 'https://developer.mozilla.org/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications' } }

/** 4. Reconnect storm: `onclose` reconnects immediately, forever. */
export const reconnectNoBackoff: Rule = {
  id: 'realtime/reconnect-no-backoff',
  pack: 'realtime',
  title: 'WebSocket reconnects instantly without backoff',
  plain: 'When the live connection drops, the app hammers the server trying to reconnect',
  severity: 'critical',
  metrics: ['wsReconnects', 'inp'],
  areas: ['websocket', 'network'],
  why: 'Reconnecting immediately in onclose creates a storm of connections when the server is down or restarting. It floods the server and keeps the browser busy.',
  frameworkRule: 'Realtime: exponential backoff',
  docs: [docs.backoff],
  steps: ['Wait before reconnecting: delay = min(30 s, 500 ms × 2^attempt) + random jitter', 'Reset the attempt counter after a successful open', 'Stop after N attempts and show a "reconnect" button'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const reconnects = pageMetric(pages, 'wsReconnects') ?? 14
    for (const file of scan.files) {
      if (!/new WebSocket\(/.test(file.text)) continue
      const lines = file.text.split('\n')
      lines.forEach((text, i) => {
        if (!/\bonclose\b|addEventListener\(\s*['"]close['"]/.test(text)) return
        const window = lines.slice(i, i + 6).join('\n')
        const reconnects_immediately = /connect\(\)|new WebSocket\(/.test(window) && !/setTimeout\([^,]+,\s*(?!0\b)[^)]*(\*\*|Math\.min|backoff|delay|attempt|retry)/i.test(window)
        if (!reconnects_immediately) return
        const line = i + 1
        out.push({
          location: loc(file, line),
          chain: { metric: 'wsReconnects', value: reconnects, element: 'ws.onclose', code: { snippet: snippet(file, line, 2), location: loc(file, line) } },
          gain: { from: reconnects, to: 1, scoreDelta: 3, note: 'server load and INP during outages' },
          changes: [{ file: file.path, before: lineText(file, line).trim(), after: `ws.onclose = () => {\n  const delay = Math.min(30_000, 500 * 2 ** attempt++) + Math.random() * 250\n  setTimeout(connect, delay)\n}` }],
          automatic: false,
          prevent: { metric: 'wsReconnects', max: 3 },
        })
      })
    }
    return out
  },
}

export const largeWebSocketMessages: Rule = {
  id: 'realtime/large-messages',
  pack: 'realtime',
  title: 'Very large WebSocket messages',
  plain: 'Live updates send more data than the screen can use',
  severity: 'info',
  metrics: ['wsMessagesPerSec'],
  areas: ['websocket'],
  why: 'Sending the full state on every tick wastes bandwidth and parsing time. Send only what changed.',
  docs: [docs.backoff],
  steps: ['Send deltas instead of full snapshots', 'Batch updates and compress large payloads'],
  detect: ({ pages }) => {
    const out: Finding[] = []
    for (const page of pages) {
      const big = page.requests.filter((r) => r.type === 'websocket' && r.transferBytes > 2_000_000)
      if (big.length) out.push({ route: page.route, chain: { metric: 'wsMessagesPerSec', value: pageMetric([page], 'wsMessagesPerSec') ?? 0, request: big[0] }, gain: { from: big[0]?.transferBytes ?? 0, to: (big[0]?.transferBytes ?? 0) * 0.2, scoreDelta: 1 }, confidence: 0.6 })
    }
    return out
  },
}

export const realtimeRules: Rule[] = [reconnectNoBackoff, largeWebSocketMessages]
