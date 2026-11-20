import { describe, expect, it } from 'vitest'

import { worstInteraction } from '../src/measure.js'

describe('worstInteraction', () => {
  it('is undefined when no interaction was observed', () => {
    expect(worstInteraction([])).toBeUndefined()
  })

  it('is the slowest interaction when there are few', () => {
    expect(worstInteraction([{ durationMs: 40 }, { durationMs: 120 }])).toBe(120)
  })
})
