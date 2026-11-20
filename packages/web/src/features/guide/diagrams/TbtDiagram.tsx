import { Timer, seg, type DiagramProps } from './Frame'

/** Tasks on the main thread while the page loads: [start, duration] in ms. */
const TASKS: [number, number][] = [
  [0, 40],
  [60, 140],
  [230, 30],
  [290, 260],
  [580, 80],
  [700, 180],
]
const ALLOWED = 50
const SPAN = 950
const X0 = 20
const WIDTH = 320
const px = (ms: number) => X0 + (ms / SPAN) * WIDTH

/** The main thread draws its tasks; everything past 50 ms in a task is shaded as blocking and adds up to TBT. */
export function TbtDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const now = seg(p, 0.04, 0.8) * SPAN
  const blocking = TASKS.reduce(
    (sum, [start, duration]) =>
      sum + Math.max(0, Math.min(now, start + duration) - (start + ALLOWED)),
    0,
  )
  return (
    <g opacity={fade}>
      <Timer
        x={X0}
        y={24}
        ms={blocking}
        label="Total Blocking Time (adds up the red parts)"
        tone={blocking > 200 ? 'warning' : 'text'}
      />
      <text x={X0} y={96} className="d-label">
        Main thread while the page loads
      </text>
      <rect x={X0} y={104} width={WIDTH} height={40} rx={4} className="d-track" />
      {TASKS.map(([start, duration]) => {
        const shown = Math.max(0, Math.min(duration, now - start))
        if (shown === 0) return null
        const fine = Math.min(shown, ALLOWED)
        const over = shown - fine
        return (
          <g key={start}>
            <rect x={px(start)} y={106} width={px(fine) - X0} height={36} className="d-task" />
            {over > 0 ? (
              <rect
                x={px(start + ALLOWED)}
                y={106}
                width={px(over) - X0}
                height={36}
                className="d-blocking"
              />
            ) : null}
            {duration > ALLOWED && shown > ALLOWED ? (
              <line
                x1={px(start + ALLOWED)}
                y1={102}
                x2={px(start + ALLOWED)}
                y2={146}
                className="d-threshold"
              />
            ) : null}
          </g>
        )
      })}
      <line x1={px(now)} y1={98} x2={px(now)} y2={150} className="d-playhead" />
      <text x={px(290)} y={164} className="d-small">
        ↑ 50 ms is allowed per task
      </text>

      <rect x={X0} y={186} width={12} height={12} className="d-task" />
      <text x={X0 + 18} y={196} className="d-small">
        Short work: fine
      </text>
      <rect x={X0 + 130} y={186} width={12} height={12} className="d-blocking" />
      <text x={X0 + 148} y={196} className="d-small">
        Over 50 ms: taps and scrolls must wait
      </text>
    </g>
  )
}
