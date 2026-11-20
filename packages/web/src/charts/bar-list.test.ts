import { describe, expect, it } from 'vitest'

import { barList } from './bar-list'

describe('barList', () => {
  it('sizes a horizontal bar list to its bars and truncates labels', () => {
    const { option, height } = barList({
      yAxis: { type: 'category', data: ['a', 'b', 'c', 'd', 'e', 'f'] },
      xAxis: { type: 'value' },
      series: [{ type: 'bar', data: [1, 2, 3, 4, 5, 6] }],
    })
    expect(height).toBe(6 * 34 + 40)
    expect(option.yAxis).toMatchObject({ triggerEvent: true, axisLabel: { overflow: 'truncate' } })
  })

  it('leaves other charts alone', () => {
    const line = {
      xAxis: { type: 'category' as const, data: ['a'] },
      series: [{ type: 'line' as const, data: [1] }],
    }
    expect(barList(line)).toEqual({ option: line })
  })
})
