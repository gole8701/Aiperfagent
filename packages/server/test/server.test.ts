import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { configSchema } from '@perfagent/config'
import { ReportStore } from '@perfagent/engine'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

import { createServer, type RunningServer } from '../src/index.js'

const fixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/reports/demo-shop-before.json',
)

let local: RunningServer
let deployed: RunningServer
let root: string

async function tempProject(withGit: boolean): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'perfagent-server-'))
  await mkdir(path.join(dir, 'src'), { recursive: true })
  await writeFile(path.join(dir, 'src', 'index.ts'), 'export const a = 1\nexport const b = 2\n')
  await writeFile(path.join(dir, '.env'), 'SECRET=1')
  if (withGit) await mkdir(path.join(dir, '.git'))
  const store = new ReportStore(dir)
  await store.init()
  await cp(fixture, path.join(dir, '.perfagent', 'reports', 'scan_fixture.json'))
  return dir
}

beforeAll(async () => {
  root = await tempProject(true)
  local = await createServer({
    config: configSchema.parse({ root, server: { port: 4701 } }),
    version: 'test',
  })
  deployed = await createServer({
    config: configSchema.parse({ root: await tempProject(false), server: { port: 4702 } }),
    version: 'test',
  })
})

afterAll(async () => {
  await local.close()
  await deployed.close()
})

function rawStatus(server: RunningServer, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: server.port,
        path: '/api/status',
        headers: { Authorization: `Bearer ${server.token}`, ...headers },
      },
      (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
      },
    )
    req.on('error', reject)
    req.end()
  })
}

const api = (
  server: RunningServer,
  route: string,
  init: RequestInit = {},
  token = server.token,
): Promise<Response> =>
  fetch(`http://127.0.0.1:${server.port}${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

describe('access control', () => {
  it('requires the session token on every API route', async () => {
    const res = await fetch(`http://127.0.0.1:${local.port}/api/status`)
    expect(res.status).toBe(401)
    const wrong = await api(local, '/api/status', {}, 'nope')
    expect(wrong.status).toBe(401)
    const ok = await api(local, '/api/status')
    expect(ok.status).toBe(200)
  })

  it('rejects requests from other origins and hosts', async () => {
    // fetch() silently drops Origin/Host overrides, so these go through the raw http client.
    expect(await rawStatus(local, { Origin: 'https://evil.example' })).toBe(403)
    expect(await rawStatus(local, { Host: 'evil.example:4701' })).toBe(403)
    expect(await rawStatus(local, { Origin: `http://127.0.0.1:${local.port}` })).toBe(200)
  })

  it('sends strict security headers', async () => {
    const res = await api(local, '/api/status')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('authenticates the WebSocket at upgrade time', async () => {
    const denied = new WebSocket(`ws://127.0.0.1:${local.port}/ws`)
    await new Promise<void>((resolve) => denied.on('error', () => resolve()))
    const allowed = new WebSocket(`ws://127.0.0.1:${local.port}/ws?token=${local.token}`)
    const hello = await new Promise<string>((resolve) =>
      allowed.on('message', (m) => resolve(m.toString())),
    )
    expect(JSON.parse(hello)).toMatchObject({ type: 'hello', mode: 'local' })
    allowed.close()
  })
})

describe('modes', () => {
  it('local mode exposes editor and fix routes; deployed mode does not have them at all', async () => {
    expect(local.mode.mode).toBe('local')
    expect(deployed.mode.mode).toBe('deployed')
    const localEditor = await api(local, '/api/editor/open', {
      method: 'POST',
      body: JSON.stringify({ file: 'src/index.ts', line: 1, editor: 'notepad++' }),
    })
    expect(localEditor.status).not.toBe(404)
    const deployedEditor = await api(deployed, '/api/editor/open', {
      method: 'POST',
      body: JSON.stringify({ file: 'src/index.ts' }),
    })
    expect(deployedEditor.status).toBe(404)
    const deployedFix = await api(deployed, '/api/fix/runs', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    expect(deployedFix.status).toBe(404)
    const status = (await (await api(deployed, '/api/status')).json()) as {
      modeReasons: string[]
      capabilities: { openEditor: boolean }
    }
    expect(status.modeReasons.join(' ')).toMatch(/git/)
    expect(status.capabilities.openEditor).toBe(false)
  })

  it('path guard protects editor and snippet routes', async () => {
    for (const file of ['../../etc/passwd', '.env', '/etc/hosts']) {
      const res = await api(local, `/api/files/snippet?file=${encodeURIComponent(file)}`)
      expect(res.status, file).toBe(403)
      const open = await api(local, '/api/editor/open', {
        method: 'POST',
        body: JSON.stringify({ file, line: 1, editor: 'vim' }),
      })
      expect(open.status, file).toBe(403)
    }
    const good = (await (
      await api(local, '/api/files/snippet?file=src/index.ts&line=1')
    ).json()) as { lines: string[] }
    expect(good.lines[0]).toContain('export const a')
  })
})

describe('reports', () => {
  it('serves the latest report, issues with chips, tree and summary', async () => {
    const latest = (await (await api(local, '/api/scans/latest')).json()) as {
      id: string
      issues: unknown[]
    }
    expect(latest.issues.length).toBeGreaterThan(0)
    const issues = (await (await api(local, '/api/issues?filter=metric:lcp')).json()) as {
      issues: { metrics: string[] }[]
      chips: { total: number }
    }
    expect(issues.issues.every((i) => i.metrics.includes('lcp'))).toBe(true)
    expect(issues.chips.total).toBeGreaterThan(0)
    const tree = (await (await api(local, '/api/tree')).json()) as { kind: string }
    expect(tree.kind).toBe('root')
    const summary = (await (await api(local, '/api/summary')).json()) as { headline: string }
    expect(summary.headline.length).toBeGreaterThan(0)
  })

  it('exports in every format and re-imports JSON identically', async () => {
    const json = await (await api(local, '/api/export/scan_fixture?format=json')).json()
    for (const format of ['csv', 'md', 'html']) {
      const res = await api(local, `/api/export/scan_fixture?format=${format}`)
      expect(res.status).toBe(200)
      expect((await res.text()).length).toBeGreaterThan(100)
    }
    const imported = await api(local, '/api/import/text', {
      method: 'POST',
      body: JSON.stringify({ text: JSON.stringify(json), filename: 'again.json' }),
    })
    const body = (await imported.json()) as {
      format: string
      exact: boolean
      report: { issues: unknown[] }
    }
    expect(body.format).toBe('perfagent')
    expect(body.exact).toBe(true)
    expect(body.report.issues.length).toBe((json as { issues: unknown[] }).issues.length)
  })

  it('renders hostile text in exports as text, never as HTML', async () => {
    const payload = JSON.parse(
      JSON.stringify(await (await api(local, '/api/export/scan_fixture?format=json')).json()),
    ) as { id: string; label?: string }
    payload.label = '<script>alert(1)</script>'
    const imported = (await (
      await api(local, '/api/import/text', {
        method: 'POST',
        body: JSON.stringify({ text: JSON.stringify(payload) }),
      })
    ).json()) as { reportId: string }
    const html = await (await api(local, `/api/export/${imported.reportId}?format=html`)).text()
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('updates issue status and compares two saved reports', async () => {
    const latest = (await (await api(local, '/api/scans/latest')).json()) as {
      id: string
      issues: { id: string }[]
    }
    const first = latest.issues[0]?.id ?? ''
    const updated = (await (
      await api(local, `/api/issues/${encodeURIComponent(first)}/status?reportId=${latest.id}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'fixed' }),
      })
    ).json()) as { status: string }
    expect(updated.status).toBe('fixed')
    const list = (await (await api(local, '/api/scans')).json()) as { reportId: string }[]
    const compare = await api(local, '/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        sources: [
          { kind: 'report', reportId: list[0]?.reportId },
          { kind: 'report', reportId: list[list.length - 1]?.reportId },
        ],
      }),
    })
    expect(compare.status).toBe(200)
    const body = (await compare.json()) as { comparison: { verdict: { sentences: string[] } } }
    expect(body.comparison.verdict.sentences.length).toBeGreaterThan(0)
  })

  it('validates settings and keeps the project root private', async () => {
    const bad = await api(local, '/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ runs: 99 }),
    })
    expect(bad.status).toBe(400)
    const good = (await (
      await api(local, '/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ runs: 2, theme: 'light' }),
      })
    ).json()) as { config: { runs: number; root?: string } }
    expect(good.config.runs).toBe(2)
    expect(good.config.root).toBeUndefined()
  })
})
