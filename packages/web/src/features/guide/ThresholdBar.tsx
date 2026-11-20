import { METRICS, formatMetric, type MetricId } from '@perfagent/core'

/** Good · needs work · poor zones from the real thresholds, with "you" from the latest report. */
export function ThresholdBar({ metric, value }: { metric: MetricId; value?: number }) {
  const m = METRICS[metric]
  if (m.good === null || m.poor === null) return null
  const lower = m.lowerIsBetter
  const max = Math.max(lower ? m.poor * 1.5 : m.good * 1.1, value ?? 0)
  const pct = (v: number): number => Math.min(100, (v / max) * 100)
  const [first, second] = lower ? [m.good, m.poor] : [m.poor, m.good]
  const zones = lower
    ? (['good', 'warning', 'critical'] as const)
    : (['critical', 'warning', 'good'] as const)
  const labels = lower
    ? [
        `Good ≤ ${formatMetric(metric, m.good)}`,
        'Needs work',
        `Poor > ${formatMetric(metric, m.poor)}`,
      ]
    : [
        `Poor < ${formatMetric(metric, m.poor)}`,
        'Needs work',
        `Good ≥ ${formatMetric(metric, m.good)}`,
      ]
  return (
    <div className="threshold">
      <div
        className="metric-bar"
        role="img"
        aria-label={`${m.name}: ${labels.join(', ')}${value !== undefined ? `. Your page: ${formatMetric(metric, value)}` : ''}`}
      >
        <div
          className="zone"
          style={{ width: `${pct(first)}%`, background: `var(--${zones[0]})` }}
        />
        <div
          className="zone"
          style={{ width: `${pct(second) - pct(first)}%`, background: `var(--${zones[1]})` }}
        />
        <div className="zone" style={{ flex: 1, background: `var(--${zones[2]})` }} />
        {value !== undefined ? (
          <div
            className={`you ${pct(value) > 85 ? 'you-end' : pct(value) < 15 ? 'you-start' : ''}`}
            style={{ left: `${pct(value)}%` }}
          >
            <span>you · {formatMetric(metric, value)}</span>
          </div>
        ) : null}
      </div>
      <div className="threshold-labels">
        {labels.map((label, i) => (
          <span key={label} className={`threshold-${zones[i] ?? 'good'}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
