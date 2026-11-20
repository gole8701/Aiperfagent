import { Mark, Phone, Timer, seg, type DiagramProps } from './Frame'

const FCP_AT = 0.4
const FCP_MS = 1500

/** A blank white screen until the first text or picture appears: that moment is FCP. */
export function FcpDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const show = (at: number) => seg(p, at, at + 0.04) * fade
  const painted = p >= FCP_AT
  const spin = (p * 1440) % 360
  return (
    <g>
      <Phone x={30} y={10} w={130} h={200} />
      {!painted ? (
        <g transform={`translate(95 112) rotate(${spin})`} opacity={fade}>
          <circle r={10} className="d-spinner-track" />
          <path d="M0 -10 A10 10 0 0 1 10 0" className="d-spinner" />
        </g>
      ) : null}
      <g opacity={show(FCP_AT)}>
        <rect x={38} y={28} width={114} height={14} className="d-bar" />
        <rect x={46} y={52} width={74} height={8} rx={3} className="d-hero" />
        <rect x={46} y={66} width={92} height={5} rx={2} className="d-content" />
        <rect x={46} y={76} width={64} height={5} rx={2} className="d-content" />
      </g>
      <rect
        x={46}
        y={92}
        width={98}
        height={60}
        rx={4}
        className="d-content"
        opacity={show(0.62)}
      />
      {painted ? (
        <rect x={40} y={46} width={110} height={40} rx={6} className="d-highlight" opacity={fade} />
      ) : null}

      <Timer
        x={190}
        y={34}
        ms={seg(p, 0, FCP_AT) * FCP_MS}
        label={painted ? 'First Contentful Paint' : 'Blank screen…'}
        tone={painted ? 'good' : 'text'}
      />
      <g opacity={painted ? fade : 0}>
        <text x={190} y={92} className="d-note">
          Something finally shows.
        </text>
        <text x={190} y={108} className="d-note">
          The visitor knows the page
        </text>
        <text x={190} y={124} className="d-note">
          is working and waits.
        </text>
      </g>
      <line x1={190} y1={170} x2={340} y2={170} className="d-axis" />
      <line
        x1={190 + 150 * seg(p, 0, 0.9)}
        y1={160}
        x2={190 + 150 * seg(p, 0, 0.9)}
        y2={180}
        className="d-playhead"
      />
      <Mark x={190 + 150 * (FCP_AT / 0.9)} label="FCP" on={painted} strong />
      <Mark x={190 + 150 * (0.62 / 0.9)} label="more content" on={p >= 0.62} />
    </g>
  )
}
