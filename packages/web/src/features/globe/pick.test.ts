import { describe, expect, it } from 'vitest'

import { nearestPoint } from './pick'

describe('nearestPoint', () => {
  const points = [
    { id: 'folder', x: 100, y: 100, problem: false },
    { id: 'bug', x: 106, y: 100, problem: true },
    { id: 'far', x: 200, y: 200, problem: true },
  ]

  it('picks the nearest point within the radius', () => {
    expect(nearestPoint(points, 99, 100)).toBe('folder')
    expect(nearestPoint(points, 150, 150)).toBeUndefined()
  })

  it('prefers a problem point on a near tie', () => {
    expect(nearestPoint(points, 102, 100)).toBe('bug')
  })
})
