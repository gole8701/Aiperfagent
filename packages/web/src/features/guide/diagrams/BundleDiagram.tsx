import { ease, seg, type DiagramProps } from './Frame'

const BOXES: { name: string; kb: number; waste?: boolean }[] = [
  { name: 'react-dom', kb: 140 },
  { name: 'your app', kb: 90 },
  { name: 'chart library', kb: 120 },
  { name: 'date-fns (3 functions used)', kb: 78, waste: true },
  { name: 'analytics', kb: 60 },
]
const FLOOR = 196
const SCALE = 0.32
/** A busy phone network moves roughly 200 KB of JavaScript per second, then the phone must still run it. */
const KB_PER_SECOND = 200

/** Pieces of JavaScript drop onto the pile; then the phone has to download all of it. */
export function BundleDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  let top = FLOOR
  let landedKb = 0
  const totalKb = BOXES.reduce((sum, b) => sum + b.kb, 0)
  const boxes = BOXES.map((box, i) => {
    const drop = ease(seg(p, 0.03 + i * 0.09, 0.1 + i * 0.09))
    const h = box.kb * SCALE
    top -= h
    if (drop === 1) landedKb += box.kb
    return { ...box, h, y: -h + (top + h) * drop, drop }
  })
  const download = seg(p, 0.55, 0.85)
  return (
    <g opacity={fade}>
      <line x1={20} y1={FLOOR} x2={176} y2={FLOOR} className="d-axis" />
      {boxes.map((box) =>
        box.drop > 0 ? (
          <g key={box.name} transform={`translate(0 ${box.y})`}>
            <rect
              x={26}
              y={0}
              width={144}
              height={box.h - 2}
              rx={4}
              className={box.waste ? 'd-blocking' : 'd-task'}
            />
            <text x={34} y={box.h / 2 + 3} className="d-on-busy">
              {box.name} · {box.kb} KB
            </text>
          </g>
        ) : null,
      )}

      <text x={196} y={34} className="d-label">
        JavaScript to download
      </text>
      <text x={196} y={64} className="d-timer">
        {landedKb} KB
      </text>

      <text x={196} y={110} className="d-label">
        Phone on a mobile network
      </text>
      <rect x={196} y={118} width={146} height={16} rx={8} className="d-track" />
      <rect x={196} y={118} width={146 * download} height={16} rx={8} className="d-fill" />
      <text x={196} y={152} className="d-small">
        {download > 0
          ? `${((download * totalKb) / KB_PER_SECOND).toFixed(1)} s of ${(totalKb / KB_PER_SECOND).toFixed(1)} s, before it can run`
          : 'waiting for the pile…'}
      </text>
      <text x={196} y={182} className="d-note">
        Red = downloaded, hardly used
      </text>
    </g>
  )
}
