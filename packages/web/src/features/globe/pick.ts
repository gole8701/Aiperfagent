export interface ScreenPoint {
  id: string
  x: number
  y: number
  /** Problem points win a near tie, so a small red dot next to a big folder is still easy to hit. */
  problem: boolean
}

/** The point nearest to (x, y) within `radius` CSS px, or undefined. */
export function nearestPoint(
  points: ScreenPoint[],
  x: number,
  y: number,
  radius = 14,
): string | undefined {
  let best: { id: string; score: number } | undefined
  for (const p of points) {
    const distance = Math.hypot(p.x - x, p.y - y)
    if (distance > radius) continue
    const score = distance - (p.problem ? 4 : 0)
    if (!best || score < best.score) best = { id: p.id, score }
  }
  return best?.id
}
