import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { configSchema } from '@perfagent/config'
import type { Issue, Report } from '@perfagent/core'
import { ReportStore } from '@perfagent/engine'
import { afterAll, describe, expect, it } from 'vitest'

import { createAiService, createKeyStore, ollamaModels } from '../src/index.js'

const MODEL = 'qwen2.5-coder:1.5b'
const models = await ollamaModels()
const available = models?.includes(MODEL) ?? false
const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/reports/demo-shop-before.json')

/** Real local-AI path; skipped when Ollama (or the model) is not on this machine. */
describe.skipIf(!available)('Ollama integration', () => {
  let root = ''
  afterAll(() => rm(root, { recursive: true, force: true }))

  it('explains a real issue through the local model and logs a zero-cost usage entry', { timeout: 300_000 }, async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'perfagent-ollama-'))
    const report = JSON.parse(await readFile(fixture, 'utf8')) as Report
    const issue = report.issues[0] as Issue
    const store = new ReportStore(root)
    const config = configSchema.parse({ root, ai: { provider: 'ollama', model: MODEL } })
    const ai = createAiService({ config, store, keyStore: createKeyStore({ dir: path.join(root, 'keys'), fileOnly: true }) })
    expect(await ai.activeProvider()).toBe('ollama')
    const text = await ai.explain(issue, [{ path: 'src/components/HeroBanner.tsx', text: '<img className="hero-image" src="/hero.png" loading="lazy" />' }])
    expect(text.trim().length).toBeGreaterThan(20)
    const usage = await ai.usage()
    expect(usage.calls).toBe(1)
    expect(usage.monthUsd).toBe(0)
    const ledger = await store.readJson<{ entries: { costUsd: number; model: string; provider: string }[] }>('ai-usage.json', { entries: [] })
    expect(ledger.entries[0]).toMatchObject({ costUsd: 0, provider: 'ollama', model: MODEL })
  })
})
