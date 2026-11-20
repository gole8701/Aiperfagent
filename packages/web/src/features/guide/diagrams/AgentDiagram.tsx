import { seg, type DiagramProps } from './Frame'

const STEPS: { label: string; detail: string; ms: number }[] = [
  { label: 'Read the page', detail: 'names of buttons and links', ms: 400 },
  { label: 'Find “Add to cart”', detail: 'button has a clear label', ms: 300 },
  { label: 'Call tool: add_to_cart', detail: 'product id from JSON-LD', ms: 900 },
  { label: 'Check the cart', detail: 'reads the result', ms: 500 },
]
const STEP_LEN = 0.18

/** An AI agent works through tool-call steps on your page, each with its own time. */
export function AgentDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.95, 1)
  let elapsed = 0
  return (
    <g opacity={fade}>
      <g transform="translate(36 32)">
        <rect x={-22} y={-18} width={44} height={36} rx={10} className="d-device" />
        <circle
          cx={-8}
          cy={-2}
          r={4}
          className={Math.floor(p * 30) % 9 === 0 ? 'd-dot' : 'd-dot-good'}
        />
        <circle
          cx={8}
          cy={-2}
          r={4}
          className={Math.floor(p * 30) % 9 === 0 ? 'd-dot' : 'd-dot-good'}
        />
        <line x1={0} y1={-18} x2={0} y2={-26} className="d-axis" />
        <text x={0} y={34} textAnchor="middle" className="d-small">
          AI agent
        </text>
      </g>
      {STEPS.map((step, i) => {
        const start = 0.05 + i * STEP_LEN
        const progress = seg(p, start, start + STEP_LEN * 0.8)
        if (progress === 1) elapsed += step.ms
        else elapsed += step.ms * progress
        const y = 16 + i * 46
        const done = progress === 1
        const active = progress > 0 && !done
        return (
          <g key={step.label} opacity={progress > 0 ? 1 : 0.35}>
            <line x1={70} y1={32} x2={84} y2={y + 16} className="d-axis" />
            <rect
              x={86}
              y={y}
              width={190}
              height={34}
              rx={8}
              className={active ? 'd-step-active' : done ? 'd-step-done' : 'd-device'}
            />
            <text x={96} y={y + 15} className="d-label">
              {i + 1}. {step.label} {done ? '✓' : ''}
            </text>
            <text x={96} y={y + 28} className="d-small">
              {step.detail}
            </text>
            <rect x={86} y={y + 34} width={190 * progress} height={3} className="d-fill" />
            <text x={286} y={y + 22} className="d-small">
              {done ? `${step.ms} ms` : active ? '…' : ''}
            </text>
          </g>
        )
      })}
      <text x={14} y={120} className="d-label">
        Total
      </text>
      <text x={14} y={146} className="d-timer d-small-timer">
        {(elapsed / 1000).toFixed(1)} s
      </text>
    </g>
  )
}
