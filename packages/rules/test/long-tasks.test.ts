import type { PageResult } from '@perfagent/core'
import { describe, expect, it } from 'vitest'

import { runRules } from '../src/engine.js'
import { heavyMainThread } from '../src/packs/general.js'

const page = (longTasks: PageResult['longTasks']): PageResult => ({
  url: 'https://shop.test/',
  route: '/',
  device: 'mobile',
  runs: 1,
  metrics: [{ id: 'tbt', value: 900, unit: 'ms' }],
  phases: [],
  requests: [],
  longTasks,
  layoutShifts: [],
  filmstrip: [],
})

const issueFor = (longTasks: PageResult['longTasks']) =>
  runRules([heavyMainThread], { pages: [page(longTasks)], packs: ['general'] })[0]

describe('general/long-tasks chain', () => {
  it('lists the scripts with the most long-task time', () => {
    const issue = issueFor([
      { startMs: 100, durationMs: 300, script: 'https://shop.test/assets/vendor.js?v=2' },
      { startMs: 500, durationMs: 200, script: 'https://shop.test/app.js render()' },
      { startMs: 900, durationMs: 250, script: 'https://shop.test/assets/vendor.js?v=2' },
      { startMs: 1300, durationMs: 400 },
    ])
    expect(issue?.chain.find((s) => s.kind === 'cost')).toEqual({
      kind: 'cost',
      label: 'Busiest scripts',
      detail: 'vendor.js 550 ms, app.js render() 200 ms',
    })
    expect(issue?.why).toContain('listed in the chain')
  })

  it('says the scripts are unknown instead of pointing at an empty chain', () => {
    const issue = issueFor([{ startMs: 100, durationMs: 400 }])
    expect(issue?.chain.map((s) => s.kind)).toEqual(['metric'])
    expect(issue?.why).not.toContain('listed in the chain')
  })
})
