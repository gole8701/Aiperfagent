import { readFileSync } from 'node:fs'
import path from 'node:path'

import { attachIssues, type Report } from '@perfagent/core'
import { describe, expect, it } from 'vitest'

import { generateTree } from '../../test/generate-tree'
import { layoutGlobe, orbitPosition } from './layout'

const sample = JSON.parse(readFileSync(path.resolve(__dirname, '../../../../../fixtures/reports/demo-shop-before.json'), 'utf8')) as Report
// The store recounts the tree the same way, because saved trees can predate some rules.
if (sample.tree) attachIssues(sample.tree, sample.issues)

describe('layoutGlobe', () => {
  it('places every folder and file of the sample report on the sphere', () => {
    const layout = layoutGlobe({ tree: sample.tree, issues: sample.issues })
    const files = layout.points.filter((p) => p.kind === 'file')
    const folders = layout.points.filter((p) => p.kind === 'folder')
    expect(folders.length).toBeGreaterThan(2)
    expect(files.length).toBeGreaterThan(10)
    for (const p of layout.points) expect(Math.hypot(...p.position)).toBeCloseTo(p.kind === 'folder' ? 1 : 1.02, 2)
    const hero = files.find((p) => p.path === 'src/components/HeroBanner.tsx')
    expect(hero?.severity).toBe('critical')
    expect(hero?.issueIds.length).toBe(1)
  })

  it('uses domains and requests when there is no project tree', () => {
    const layout = layoutGlobe({ page: sample.pages[0], issues: sample.issues })
    expect(layout.points.filter((p) => p.kind === 'folder').length).toBeGreaterThan(0)
    expect(layout.points.filter((p) => p.kind === 'file').length).toBe(sample.pages[0]?.requests.length)
  })

  it('lays out 5,000 nodes in under 50 ms', () => {
    const tree = generateTree(5000)
    const start = performance.now()
    const layout = layoutGlobe({ tree, issues: [] })
    const elapsed = performance.now() - start
    expect(layout.points.length).toBeGreaterThanOrEqual(5000)
    expect(elapsed).toBeLessThan(50)
  })

  it('keeps orbiting files on the sphere surface', () => {
    const p = orbitPosition([0, 1, 0], [1, 0, 0], [0, 0, 1], 0.2, 1.3)
    expect(Math.hypot(...p)).toBeCloseTo(1.02, 5)
  })
})
