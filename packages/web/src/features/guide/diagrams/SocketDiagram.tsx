import { seg, type DiagramProps } from './Frame'

const DROP = 0.3
/** Reconnect attempts after the drop, as loop progress: a storm hammers, backoff waits longer each time. */
const STORM = Array.from({ length: 22 }, (_, i) => DROP + 0.02 + i * 0.025)
const BACKOFF = [0.36, 0.43, 0.57, 0.85]

/** Messages flow, the connection drops, then a reconnect storm versus a calm backoff. */
export function SocketDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.95, 1)
  return (
    <g opacity={fade}>
      <Lane y={20} title="Reconnect at once, again and again" attempts={STORM} p={p} bad />
      <Lane y={118} title="Wait 0.5 s, 1 s, 2 s, 4 s… (backoff)" attempts={BACKOFF} p={p} />
    </g>
  )
}

function Lane({
  y,
  title,
  attempts,
  p,
  bad,
}: {
  y: number
  title: string
  attempts: number[]
  p: number
  bad?: boolean
}) {
  const down = p >= DROP && p < (attempts.at(-1) ?? DROP)
  const tries = attempts.filter((at) => at <= p).length
  // Before the drop, a message bounces back and forth every 0.1 of the loop.
  const phase = (p * 10) % 1
  return (
    <g transform={`translate(0 ${y})`}>
      <text x={14} y={10} className="d-label">
        {title}
      </text>
      <rect x={14} y={22} width={60} height={50} rx={8} className="d-device" />
      <text x={44} y={52} textAnchor="middle" className="d-small">
        App
      </text>
      <rect x={286} y={22} width={60} height={50} rx={8} className="d-device" />
      <text x={316} y={52} textAnchor="middle" className="d-small">
        Server
      </text>
      <line x1={80} y1={47} x2={280} y2={47} className={down ? 'd-wire-down' : 'd-axis'} />
      {p < DROP ? (
        <circle
          cx={phase < 0.5 ? 80 + 400 * phase : 280 - 400 * (phase - 0.5)}
          cy={47}
          r={5}
          className="d-packet-good"
        />
      ) : null}
      {down ? (
        <text x={180} y={40} textAnchor="middle" className="d-small">
          connection lost
        </text>
      ) : null}
      {attempts.map((at) => {
        const flight = seg(p, at, at + 0.05)
        return flight > 0 && flight < 1 ? (
          <circle
            key={at}
            cx={80 + 200 * flight}
            cy={58}
            r={3.5}
            className={bad ? 'd-packet-bad' : 'd-packet'}
          />
        ) : null
      })}
      <text
        x={180}
        y={88}
        textAnchor="middle"
        className={`d-small ${bad && tries > 8 ? 'd-critical' : ''}`}
      >
        {p < DROP
          ? 'messages flowing'
          : down
            ? `${tries} reconnect tries${bad && tries > 8 ? ': the server is flooded' : ''}`
            : bad
              ? `${tries} tries: every user did this at once`
              : `${tries} calm tries, then connected ✓`}
      </text>
    </g>
  )
}
