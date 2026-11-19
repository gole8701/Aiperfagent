import { METRICS, metricValue } from './metrics.js'
import type { Issue, MetricId, MetricValue } from './types.js'

/**
 * Lighthouse-style weighted score: each metric is mapped onto 0–100 with a
 * log-normal curve anchored at its good/poor thresholds, then weighted.
 */
const WEIGHTS: Partial<Record<MetricId, number>> = {
  lcp: 0.25,
  tbt: 0.3,
  cls: 0.25,
  fcp: 0.1,
  si: 0.1,
}

function curve(id: MetricId, value: number): number {
  const m = METRICS[id]
  if (m.good === null || m.poor === null) return 100
  // Log-normal mapping where good → 90 and poor → 50, as Lighthouse does.
  const median = m.poor
  const p10 = m.good
  if (value <= 0) return 100
  const sigma = Math.log(median / p10) / 1.2816 // z(0.9) ≈ 1.2816
  const z = Math.log(value / median) / sigma
  const cdf = 0.5 * (1 + erf(z / Math.SQRT2))
  return Math.round(Math.max(0, Math.min(100, (1 - cdf) * 100)))
}

function erf(x: number): number {
  // Abramowitz–Stegun approximation, accurate to ~1e-7; plenty for a score.
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax)
  return sign * y
}

export function computeScore(metrics: MetricValue[]): number {
  let total = 0
  let weightSum = 0
  for (const [id, weight] of Object.entries(WEIGHTS) as [MetricId, number][]) {
    const value = metricValue(metrics, id)
    if (value === undefined) continue
    total += curve(id, value) * weight
    weightSum += weight
  }
  if (weightSum === 0) return 0
  return Math.round(total / weightSum)
}

/** Score the page would reach if every listed issue were fixed (lab estimate). */
export function projectedScore(current: number, issues: Issue[]): number {
  const gain = issues.filter((i) => i.status === 'open').reduce((sum, i) => sum + i.gain.scoreDelta, 0)
  // Gains overlap (two fixes to the same metric don't add up fully), so taper them.
  const tapered = gain * (1 - Math.min(0.35, issues.length * 0.03))
  return Math.min(100, Math.round(current + tapered))
}

export function metricScore(id: MetricId, value: number): number {
  return curve(id, value)
}
