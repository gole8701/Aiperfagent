import { METRICS } from '@perfagent/core'

import { seg, type DiagramProps } from './Frame'

const X0 = 40
const X1 = 340
const Y0 = 186
const MAX_MB = 200
const y = (mb: number) => Y0 - (mb / MAX_MB) * 150
/** Memory grows while the page is used and drops at each clean-up (garbage collection). */
const sawtooth = (t: number) => 18 * (t * 7 - Math.floor(t * 7))
const healthy = (t: number) => 28 + sawtooth(t)
const leaking = (t: number) => 28 + 150 * t + sawtooth(t)

function line(fn: (t: number) => number, until: number): string {
  const points: string[] = []
  for (let t = 0; t <= until; t += 0.004) points.push(`${X0 + t * (X1 - X0)},${y(fn(t))}`)
  return `M${points.join(' L')}`
}

/** Two heap graphs: a healthy one that returns to the same level, and a leak that keeps climbing. */
export function MemoryDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const t = seg(p, 0.03, 0.85)
  const { good, poor } = METRICS.memoryMb
  const now = leaking(t)
  return (
    <g opacity={fade}>
      <line x1={X0} y1={Y0} x2={X1} y2={Y0} className="d-axis" />
      <line x1={X0} y1={Y0} x2={X0} y2={30} className="d-axis" />
      <text x={X0 - 6} y={y(0) + 3} textAnchor="end" className="d-small">
        0
      </text>
      {[good, poor].map((mb, i) =>
        mb === null ? null : (
          <g key={mb}>
            <line x1={X0} y1={y(mb)} x2={X1} y2={y(mb)} className="d-threshold" />
            <text x={X0 - 6} y={y(mb) + 3} textAnchor="end" className="d-small">
              {mb}
            </text>
            <text x={X1} y={y(mb) - 4} textAnchor="end" className="d-small">
              {i === 0 ? 'good up to here' : 'poor above here'}
            </text>
          </g>
        ),
      )}
      <text x={X0} y={208} className="d-small">
        Time using the page → (MB of memory)
      </text>

      <path d={line(healthy, t)} className="d-line-good" />
      <path d={line(leaking, t)} className="d-line-bad" />
      <circle cx={X0 + t * (X1 - X0)} cy={y(now)} r={4} className="d-packet" />

      <text x={X0 + 8} y={22} className={`d-label ${now > (poor ?? 150) ? 'd-critical' : ''}`}>
        Leak: {Math.round(now)} MB and climbing
      </text>
      <text x={X0 + 190} y={22} className="d-label d-good">
        Healthy: back down
      </text>
    </g>
  )
}
