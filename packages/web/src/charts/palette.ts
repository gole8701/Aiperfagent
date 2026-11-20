import { token } from '../state/theme'
import type { Palette } from './definitions/types'

/** Colour-blind-safe chart palette read from the active theme's CSS tokens. */
export function readPalette(): Palette {
  return {
    text: token('--text'),
    muted: token('--muted'),
    border: token('--border'),
    panel: token('--panel'),
    good: token('--good'),
    warning: token('--warning'),
    critical: token('--critical'),
    accent: token('--accent'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => token(`--chart-${i}`)),
  }
}
