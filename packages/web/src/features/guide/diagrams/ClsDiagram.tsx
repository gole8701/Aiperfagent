import { Finger, Phone, ease, seg, type DiagramProps } from './Frame'

const LOAD = 0.42

/**
 * Two phones side by side. On the left an image without a size loads and pushes
 * the button down just as the finger taps; on the right the space was reserved.
 */
export function ClsDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const grow = ease(seg(p, LOAD, LOAD + 0.06))
  const aim = ease(seg(p, 0.08, 0.34))
  const tapped = p >= 0.5
  return (
    <g opacity={fade}>
      <text x={95} y={14} textAnchor="middle" className="d-label">
        Image without a size
      </text>
      <Screen x={30} grow={grow} reserved={false} />
      <Finger x={150 - 55 * aim} y={215 - 113 * aim} pressed={tapped && p < 0.56} />
      {tapped ? (
        <g opacity={seg(p, 0.5, 0.54)}>
          <rect x={44} y={93} width={102} height={20} rx={5} className="d-alert" />
          <text x={95} y={107} textAnchor="middle" className="d-alert-text">
            Missed! The button moved
          </text>
        </g>
      ) : null}

      <text x={265} y={14} textAnchor="middle" className="d-label">
        Space reserved
      </text>
      <Screen x={200} grow={grow} reserved />
      <Finger x={320 - 55 * aim} y={215 - 57 * aim} pressed={tapped && p < 0.56} />
      {tapped ? (
        <g opacity={seg(p, 0.5, 0.54)}>
          <rect x={214} y={176} width={102} height={20} rx={5} className="d-ok" />
          <text x={265} y={190} textAnchor="middle" className="d-ok-text">
            Tapped ✓ Nothing jumped
          </text>
        </g>
      ) : null}
    </g>
  )
}

/** One phone: heading, a picture that appears at LOAD, and the "Buy" button under it. */
function Screen({ x, grow, reserved }: { x: number; grow: number; reserved: boolean }) {
  const imageH = 56
  // Without a size the picture takes no room until it loads, then pushes everything down.
  const shift = reserved ? 0 : imageH * grow
  const top = 46
  return (
    <g transform="translate(0 10)">
      <Phone x={x} y={10} w={130} h={190} />
      <rect x={x + 16} y={top - 10} width={70} height={7} rx={3} className="d-content" />
      {reserved ? (
        <rect x={x + 16} y={top} width={98} height={imageH} rx={4} className="d-placeholder" />
      ) : null}
      <rect
        x={x + 16}
        y={top}
        width={98}
        height={imageH * grow}
        rx={4}
        className="d-hero"
        opacity={grow > 0 ? 1 : 0}
      />
      <g transform={`translate(0 ${reserved ? imageH : shift})`}>
        <rect x={x + 16} y={top + 8} width={98} height={6} rx={3} className="d-content" />
        <rect x={x + 16} y={top + 18} width={60} height={6} rx={3} className="d-content" />
        <rect x={x + 20} y={top + 34} width={90} height={24} rx={6} className="d-button" />
        <text x={x + 65} y={top + 50} textAnchor="middle" className="d-button-text">
          Buy now
        </text>
      </g>
    </g>
  )
}
