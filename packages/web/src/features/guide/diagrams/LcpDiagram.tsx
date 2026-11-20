import { Mark, Phone, Timer, seg, type DiagramProps } from './Frame'

const LCP_AT = 0.55
const LCP_MS = 2400

/** A page loads on a phone; the biggest picture paints last and the clock stops there. */
export function LcpDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const show = (at: number) => seg(p, at, at + 0.04) * fade
  const painted = p >= LCP_AT
  return (
    <g>
      <Phone x={30} y={10} w={130} h={200} />
      <g>
        <rect x={38} y={28} width={114} height={14} className="d-bar" opacity={show(0.1)} />
        <rect
          x={46}
          y={50}
          width={70}
          height={7}
          rx={3}
          className="d-content"
          opacity={show(0.18)}
        />
        <rect
          x={46}
          y={62}
          width={50}
          height={5}
          rx={2}
          className="d-content"
          opacity={show(0.18)}
        />
        <g opacity={show(LCP_AT)}>
          <rect x={46} y={74} width={98} height={62} rx={4} className="d-hero" />
          <path d="M46 136 L76 104 L96 122 L114 98 L144 136 Z" className="d-hero-shape" />
          <circle cx={128} cy={88} r={7} className="d-hero-sun" />
        </g>
        <rect
          x={46}
          y={144}
          width={46}
          height={40}
          rx={4}
          className="d-content"
          opacity={show(0.28)}
        />
        <rect
          x={98}
          y={144}
          width={46}
          height={40}
          rx={4}
          className="d-content"
          opacity={show(0.28)}
        />
        {painted ? (
          <rect
            x={42}
            y={70}
            width={106}
            height={70}
            rx={6}
            className="d-highlight"
            opacity={fade}
          />
        ) : null}
      </g>

      <Timer
        x={190}
        y={34}
        ms={seg(p, 0, LCP_AT) * LCP_MS}
        label={painted ? 'Largest Contentful Paint' : 'Loading…'}
        tone={painted ? 'good' : 'text'}
      />
      <g opacity={painted ? fade : 0}>
        <text x={190} y={92} className="d-note">
          The biggest picture is on screen.
        </text>
        <text x={190} y={108} className="d-note">
          This is the moment people feel
        </text>
        <text x={190} y={124} className="d-note">
          “the page has loaded”.
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
      <Mark x={190 + 150 * (0.1 / 0.9)} label="first paint" on={p >= 0.1} />
      <Mark x={190 + 150 * (LCP_AT / 0.9)} label="LCP" on={painted} strong />
    </g>
  )
}
