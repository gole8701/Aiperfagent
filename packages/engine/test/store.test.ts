import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Report } from '@perfagent/core'
import { describe, expect, it } from 'vitest'

import { ReportStore } from '../src/index.js'

const fixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/reports/demo-shop-before.json',
)

async function setup(): Promise<{ store: ReportStore; project: Report }> {
  const store = new ReportStore(await mkdtemp(path.join(os.tmpdir(), 'perfagent-store-')))
  const project = JSON.parse(await readFile(fixture, 'utf8')) as Report
  return { store, project }
}

describe('ReportStore history', () => {
  it('keeps URL scans in their own series and the project report as latest', async () => {
    const { store, project } = await setup()
    await store.save(project)
    const { tree: _tree, ...rest } = project
    const urlScan: Report = {
      ...rest,
      id: 'scan_url',
      createdAt: '2030-01-01T00:00:00.000Z',
      pages: project.pages.map((p) => ({ ...p, url: 'https://www.flipkart.com/' })),
    }
    await store.save(urlScan)
    expect((await store.latest())?.id).toBe(project.id)
    const list = await store.list()
    expect(list.map((h) => h.target)).toEqual([undefined, 'www.flipkart.com'])
  })

  it('never records an unmeasured score as 0 and does not duplicate a re-saved report', async () => {
    const { store, project } = await setup()
    const sourceOnly: Report = { ...project, id: 'scan_source', pages: [] }
    await store.save(sourceOnly)
    await store.save(sourceOnly)
    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.score).toBeUndefined()
  })
})
