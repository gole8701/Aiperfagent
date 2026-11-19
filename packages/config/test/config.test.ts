import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, configSchema, describeConfig, envOverrides, loadConfig } from '../src/index.js'

describe('config', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_CONFIG.server.port).toBe(4545)
    expect(DEFAULT_CONFIG.runs).toBe(3)
    expect(DEFAULT_CONFIG.ai.provider).toBe('none')
    expect(DEFAULT_CONFIG.fix.review).toBe(true)
    expect(DEFAULT_CONFIG.fix.autoCommit).toBe(false)
    expect(DEFAULT_CONFIG.fix.openPr).toBe(false)
  })

  it('rejects unknown keys and bad values', () => {
    expect(configSchema.safeParse({ runs: 50 }).success).toBe(false)
    expect(configSchema.safeParse({ unknownOption: 1 }).success).toBe(false)
    expect(configSchema.safeParse({ budgets: { '/': { js: '200 bananas' } } }).success).toBe(false)
    expect(configSchema.safeParse({ budgets: { '/': { js: '200kb', lcp: 2500 } } }).success).toBe(true)
  })

  it('maps PERFAGENT_* environment variables onto the schema', () => {
    const env = { PERFAGENT_SERVER_PORT: '5000', PERFAGENT_AI_PROVIDER: 'ollama', PERFAGENT_FIX_AUTOACCEPT: 'true', PERFAGENT_URLS: 'http://a.test,http://b.test', OTHER: 'x' }
    expect(envOverrides(env)).toEqual({ server: { port: 5000 }, ai: { provider: 'ollama' }, fix: { autoAccept: true }, urls: ['http://a.test', 'http://b.test'] })
  })

  it('loads defaults → file → env → flags in that order', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'perfagent-config-'))
    await writeFile(path.join(dir, 'perfagent.config.json'), JSON.stringify({ runs: 5, device: 'desktop', server: { port: 4600 } }))
    const { config, file } = await loadConfig({ cwd: dir, env: { PERFAGENT_RUNS: '7' }, overrides: { device: 'mobile' } })
    expect(file).toContain('perfagent.config.json')
    expect(config.runs).toBe(7)
    expect(config.device).toBe('mobile')
    expect(config.server.port).toBe(4600)
    expect(path.isAbsolute(config.root)).toBe(true)
  })

  it('explains an invalid file in plain words', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'perfagent-config-'))
    await writeFile(path.join(dir, 'perfagent.config.json'), JSON.stringify({ runs: 'many' }))
    await expect(loadConfig({ cwd: dir, env: {} })).rejects.toMatchObject({ code: 'CONFIG_INVALID' })
  })

  it('describes every option for the settings UI and docs', () => {
    const rows = describeConfig()
    const port = rows.find((r) => r.path === 'server.port')
    expect(port).toMatchObject({ type: 'number', default: 4545 })
    expect(rows.find((r) => r.path === 'ai.provider')?.choices).toContain('ollama')
    expect(rows.length).toBeGreaterThan(30)
  })
})
