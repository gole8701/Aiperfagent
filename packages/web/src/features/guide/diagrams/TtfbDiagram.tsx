import { Timer, ease, seg, type DiagramProps } from './Frame'

const SENT = 0.25
const READY = 0.55
const ARRIVED = 0.75
const TTFB_MS = 620

/** Browser asks, the server thinks, the first byte travels back. The clock stops when it lands. */
export function TtfbDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const out = ease(seg(p, 0.03, SENT))
  const back = ease(seg(p, READY, ARRIVED))
  const thinking = p >= SENT && p < READY
  const arrived = p >= ARRIVED
  return (
    <g opacity={fade}>
      <rect x={14} y={70} width={90} height={70} rx={8} className="d-device" />
      <rect x={14} y={70} width={90} height={14} rx={7} className="d-bar" />
      <circle cx={22} cy={77} r={2.5} className="d-dot" />
      <circle cx={30} cy={77} r={2.5} className="d-dot" />
      <text x={59} y={118} textAnchor="middle" className="d-label">
        Browser
      </text>

      <rect x={256} y={62} width={90} height={86} rx={8} className="d-device" />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={266}
          y={72 + i * 22}
          width={70}
          height={14}
          rx={3}
          className={thinking && Math.floor(p * 40) % 3 === i ? 'd-busy' : 'd-track'}
        />
      ))}
      <text x={301} y={164} textAnchor="middle" className="d-label">
        Server
      </text>

      <line x1={110} y1={92} x2={248} y2={92} className="d-axis" markerEnd="url(#d-arrow)" />
      <line x1={248} y1={120} x2={110} y2={120} className="d-axis" markerEnd="url(#d-arrow)" />
      <text x={179} y={84} textAnchor="middle" className="d-small">
        1. “Send me the page”
      </text>
      <text x={179} y={138} textAnchor="middle" className="d-small">
        3. First byte of the answer
      </text>
      {thinking ? (
        <text x={301} y={186} textAnchor="middle" className="d-small">
          2. building the page…
        </text>
      ) : null}
      {p > 0.03 && p < SENT ? (
        <circle cx={110 + 138 * out} cy={92} r={6} className="d-packet" />
      ) : null}
      {p > READY && !arrived ? (
        <circle cx={248 - 138 * back} cy={120} r={6} className="d-packet-good" />
      ) : null}

      <Timer
        x={130}
        y={24}
        ms={seg(p, 0.03, ARRIVED) * TTFB_MS}
        label={arrived ? 'Time to First Byte' : 'Waiting for the server…'}
        tone={arrived ? 'good' : 'text'}
      />
    </g>
  )
}
