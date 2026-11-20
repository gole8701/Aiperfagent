import { Finger, Phone, Timer, ease, seg, type DiagramProps } from './Frame'

const TAP = 0.22
const UPDATE = 0.6
const DELAY_MS = 360

/** A tap on "Add to cart", a busy main thread, then the screen finally reacts. */
export function InpDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const move = ease(seg(p, 0.04, 0.2))
  const fingerX = 230 + (95 - 230) * move
  const fingerY = 205 + (166 - 205) * move
  const busy = seg(p, TAP, UPDATE)
  const updated = p >= UPDATE
  const waiting = p >= TAP && !updated
  return (
    <g opacity={fade}>
      <Phone x={30} y={10} w={130} h={200} />
      <rect x={38} y={28} width={114} height={14} className="d-bar" />
      <g transform="translate(136 35)">
        <rect x={-7} y={-5} width={14} height={10} rx={2} className="d-line" />
        {updated ? (
          <g transform={`scale(${1 + 0.4 * (1 - seg(p, UPDATE, UPDATE + 0.06))})`}>
            <circle cx={8} cy={-6} r={6} className="d-badge" />
            <text x={8} y={-3.5} textAnchor="middle" className="d-badge-text">
              1
            </text>
          </g>
        ) : null}
      </g>
      <rect x={46} y={52} width={98} height={56} rx={4} className="d-content" />
      <rect x={46} y={116} width={72} height={7} rx={3} className="d-content" />
      <rect x={46} y={128} width={40} height={6} rx={3} className="d-content" />
      <rect
        x={50}
        y={154}
        width={90}
        height={24}
        rx={6}
        className={updated ? 'd-button-done' : waiting ? 'd-button-pressed' : 'd-button'}
      />
      <text x={95} y={170} textAnchor="middle" className="d-button-text">
        {updated ? 'Added ✓' : 'Add to cart'}
      </text>
      <Finger x={fingerX} y={fingerY} pressed={p >= TAP && p < TAP + 0.05} />

      <Timer
        x={190}
        y={34}
        ms={busy * DELAY_MS}
        label={
          updated
            ? 'Delay after the tap (INP)'
            : waiting
              ? 'Waiting for the page…'
              : 'Tap the button'
        }
        tone={updated ? 'warning' : 'text'}
      />
      <text x={190} y={98} className="d-label">
        Main thread
      </text>
      <rect x={190} y={106} width={150} height={20} rx={4} className="d-track" />
      <rect x={190} y={106} width={150 * busy} height={20} rx={4} className="d-busy" />
      {waiting ? (
        <text x={196} y={120} className="d-on-busy">
          busy running JavaScript
        </text>
      ) : null}
      <g opacity={updated ? 1 : 0}>
        <text x={190} y={150} className="d-note">
          The screen changed {DELAY_MS} ms after
        </text>
        <text x={190} y={166} className="d-note">
          the tap. Under 200 ms feels instant.
        </text>
      </g>
    </g>
  )
}
