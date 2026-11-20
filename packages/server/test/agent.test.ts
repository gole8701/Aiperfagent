import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { configSchema } from '@perfagent/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createServer, type RunningServer } from '../src/index.js'

const SITE = 'http://shop.local:3000'
let root: string
let server: RunningServer
let script: string

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'perfagent-server-'))
  script = path.join(root, 'perfagent.js')
  await writeFile(script, '/* agent */')
  const config = configSchema.parse({
    root,
    urls: [SITE],
    server: { port: 20000 + Math.floor(Math.random() * 20000), open: false },
  })
  server = await createServer({ config, version: 'test', agentScriptPath: script })
})
afterAll(async () => {
  await server.close()
  await rm(root, { recursive: true, force: true })
})

const base = (): string => `http://127.0.0.1:${server.port}`

describe('real-user agent endpoints', () => {
  it('serves the snippet publicly with caching', async () => {
    const res = await fetch(`${base()}/agent/perfagent.js`, {
      headers: { origin: 'https://anything.example' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(await res.text()).toBe('/* agent */')
  })

  it('accepts batches only from configured site origins, validates, redacts and stores them', async () => {
    const batch = [
      {
        t: 'req',
        at: 1,
        route: '/checkout',
        url: 'https://shop.local/api?x=1',
        status: 200,
        ms: 12,
        extra: 'dropped',
        message: 'token=abcdef123456',
      },
      { t: 'bogus' },
    ]
    const preflight = await fetch(`${base()}/agent/collect`, {
      method: 'OPTIONS',
      headers: { origin: SITE },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(SITE)
    const ok = await fetch(`${base()}/agent/collect`, {
      method: 'POST',
      headers: { origin: SITE, 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ received: 1 })
    const rum = await readFile(path.join(root, '.perfagent', 'rum.jsonl'), 'utf8')
    expect(rum).not.toContain('dropped')
    expect(rum).not.toContain('abcdef123456')
    const other = await fetch(`${base()}/agent/collect`, {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '[]',
    })
    expect(other.status).toBe(403)
    const noOrigin = await fetch(`${base()}/agent/collect`, { method: 'POST', body: '[]' })
    expect(noOrigin.status).toBe(403)
  })

  it('still rejects foreign origins on the API and writes server.json while running', async () => {
    const res = await fetch(`${base()}/api/status`, { headers: { origin: SITE } })
    expect(res.status).toBe(403)
    const info = JSON.parse(
      await readFile(path.join(root, '.perfagent', 'server.json'), 'utf8'),
    ) as { url: string; pid: number }
    expect(info.url).toBe(server.url)
    expect(info.pid).toBe(process.pid)
    await server.close()
    await expect(stat(path.join(root, '.perfagent', 'server.json'))).rejects.toThrow()
  })
})
