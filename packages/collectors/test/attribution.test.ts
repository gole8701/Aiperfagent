import type { RequestInfo } from '@perfagent/core'
import { describe, expect, it } from 'vitest'

import { attributeTasks } from '../src/attribution.js'

const script = (url: string, startMs: number, durationMs: number): RequestInfo => ({
  url,
  type: 'script',
  transferBytes: 1000,
  startMs,
  durationMs,
  status: 200,
  thirdParty: false,
  cached: false,
})

describe('attributeTasks', () => {
  const frames = [
    {
      startMs: 100,
      durationMs: 120,
      blockingMs: 70,
      script: 'https://a.test/app.js',
      fn: 'boot',
      line: 42,
    },
  ]
  const requests = [
    script('https://a.test/early.js', 0, 200),
    script('https://a.test/late.js', 0, 900),
  ]

  it('keeps a task that already names its script', () => {
    const [t] = attributeTasks(
      [{ startMs: 120, durationMs: 80, script: 'own.js' }],
      frames,
      requests,
    )
    expect(t?.script).toBe('own.js')
  })

  it('uses the long animation frame that contains the task', () => {
    const [t] = attributeTasks([{ startMs: 120, durationMs: 80 }], frames, requests)
    expect(t).toMatchObject({ script: 'https://a.test/app.js', fn: 'boot', line: 42 })
  })

  it('falls back to the script that finished loading just before the task', () => {
    const [t] = attributeTasks([{ startMs: 500, durationMs: 80 }], frames, requests)
    expect(t?.script).toBe('https://a.test/early.js')
  })

  it('leaves the script empty when nothing matches', () => {
    const [t] = attributeTasks([{ startMs: 50, durationMs: 80 }], frames, requests)
    expect(t?.script).toBeUndefined()
  })
})
