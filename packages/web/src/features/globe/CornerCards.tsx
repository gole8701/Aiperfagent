import { formatMetric, metricValue, type Report } from '@perfagent/core'

interface CornerCardsProps {
  report: Report
}

/** The four facts the mock-up pins to the globe's corners: slowest LCP, live WebSocket, AI, bundle. */
export function CornerCards({ report }: CornerCardsProps) {
  const slowest = [...report.pages].sort(
    (a, b) => (metricValue(b.metrics, 'lcp') ?? 0) - (metricValue(a.metrics, 'lcp') ?? 0),
  )[0]
  const lcp = slowest ? metricValue(slowest.metrics, 'lcp') : undefined
  const live = report.live
  const wsRate = live ? average(live.websocket.messagesPerSec) : undefined
  const ai = report.ai
  const aiCost = ai ? ai.calls.reduce((sum, c) => sum + c.costUsd, 0) : undefined
  const aiFirst = ai?.models[0]?.p95FirstTokenMs
  const js = slowest ? metricValue(slowest.metrics, 'jsKb') : undefined
  const requests = slowest ? metricValue(slowest.metrics, 'requests') : undefined

  return (
    <div className="corner-cards" aria-label="Key facts">
      <div className="corner-card">
        <span className="muted">LCP · slowest page</span>
        <strong>{lcp !== undefined ? formatMetric('lcp', lcp) : '—'}</strong>
        <span className="mono">{slowest?.route ?? ''}</span>
      </div>
      <div className="corner-card">
        <span className="muted">Live · WebSocket</span>
        <strong>{wsRate !== undefined ? `${Math.round(wsRate)} msg/s` : 'not recorded'}</strong>
        <span>
          {live ? `${live.websocket.reconnects.length} reconnects` : 'Start Live to record'}
        </span>
      </div>
      <div className="corner-card">
        <span className="muted">AI · first token p95</span>
        <strong>
          {aiFirst !== undefined
            ? formatMetric('aiFirstTokenMs', aiFirst)
            : ai?.callSites.length
              ? `${ai.callSites.length} call sites`
              : 'no AI calls'}
        </strong>
        <span>
          {aiCost !== undefined && ai?.calls.length
            ? `${formatMetric('aiCostUsd', aiCost)} measured`
            : ai?.callSites.length
              ? 'wrap calls to measure'
              : ''}
        </span>
      </div>
      <div className="corner-card">
        <span className="muted">Bundle · first load</span>
        <strong>{js !== undefined ? `${formatMetric('jsKb', js)} JS` : '—'}</strong>
        <span>{requests !== undefined ? `${requests} requests` : ''}</span>
      </div>
    </div>
  )
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}
