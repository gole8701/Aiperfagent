import { METRICS, metricScore, type MetricId } from '@perfagent/core'

import { ease, seg, type DiagramProps } from './Frame'

// Same weights as computeScore in packages/core/src/score.ts (Lighthouse 10).
// shortcut: copied because core does not export them; export WEIGHTS from core if they ever change.
const PARTS: { id: MetricId; weight: number; example: number }[] = [
  { id: 'tbt', weight: 0.3, example: 380 },
  { id: 'lcp', weight: 0.25, example: 3100 },
  { id: 'cls', weight: 0.25, example: 0.06 },
  { id: 'fcp', weight: 0.1, example: 1900 },
  { id: 'si', weight: 0.1, example: 4100 },
]

/** Each metric becomes 0–100, gets its weight, and the needle adds them up. */
export function ScoreDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  let total = 0
  const rows = PARTS.map((part, i) => {
    const fill = ease(seg(p, 0.06 + i * 0.13, 0.16 + i * 0.13))
    const sub = metricScore(part.id, part.example)
    total += sub * part.weight * fill
    return { ...part, sub, fill }
  })
  const score = Math.round(total)
  const { good, poor } = METRICS.score
  const tone = score >= (good ?? 90) ? 'good' : score >= (poor ?? 50) ? 'warning' : 'critical'
  const angle = Math.PI * (1 - total / 100)
  return (
    <g opacity={fade}>
      <path d="M20 140 A70 70 0 0 1 160 140" className="d-gauge-track" />
      <path d={arc(poor ?? 50, good ?? 90)} className="d-gauge-warning" />
      <path d={arc(good ?? 90, 100)} className="d-gauge-good" />
      <path d={arc(0, poor ?? 50)} className="d-gauge-critical" />
      <line
        x1={90}
        y1={140}
        x2={90 + 58 * Math.cos(angle)}
        y2={140 - 58 * Math.sin(angle)}
        className="d-needle"
      />
      <circle cx={90} cy={140} r={6} className="d-needle-hub" />
      <text x={90} y={178} textAnchor="middle" className={`d-timer d-${tone}`}>
        {score}
      </text>
      <text x={90} y={198} textAnchor="middle" className="d-small">
        Performance score
      </text>

      {rows.map((row, i) => {
        const y = 30 + i * 36
        return (
          <g key={row.id} opacity={0.35 + 0.65 * Math.min(1, row.fill * 4)}>
            <text x={186} y={y} className="d-label">
              {METRICS[row.id].short} · {Math.round(row.weight * 100)}% of the score
            </text>
            <rect x={186} y={y + 6} width={150} height={10} rx={5} className="d-track" />
            <rect
              x={186}
              y={y + 6}
              width={1.5 * row.sub * row.fill}
              height={10}
              rx={5}
              className="d-fill"
            />
            <text x={340} y={y} textAnchor="end" className="d-small">
              {Math.round(row.sub * row.fill)}/100
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** An arc of the gauge between two scores (0 = left, 100 = right). */
function arc(from: number, to: number): string {
  const point = (score: number) => {
    const a = Math.PI * (1 - score / 100)
    return `${(90 + 70 * Math.cos(a)).toFixed(1)} ${(140 - 70 * Math.sin(a)).toFixed(1)}`
  }
  return `M${point(from)} A70 70 0 0 1 ${point(to)}`
}
