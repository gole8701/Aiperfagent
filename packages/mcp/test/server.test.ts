import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { configSchema } from '@perfagent/config'
import { ReportStore } from '@perfagent/engine'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildMcpServer, writesAllowed, type McpServerOptions } from '../src/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = path.resolve(here, '../../../fixtures/reports/demo-shop-before.json')
const guides = path.resolve(here, '../../../docs/guides')

let root: string
let store: ReportStore
let fixtureId: string
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'perfagent-mcp-'))
  await mkdir(path.join(root, '.perfagent', 'reports'), { recursive: true })
  fixtureId = (JSON.parse(await readFile(fixture, 'utf8')) as { id: string }).id
  await cp(fixture, path.join(root, '.perfagent', 'reports', `${fixtureId}.json`))
  store = new ReportStore(root)
})
afterAll(() => rm(root, { recursive: true, force: true }))

async function connect(extra: Partial<McpServerOptions> = {}): Promise<Client> {
  const config = configSchema.parse({ root })
  const server = buildMcpServer({
    config,
    store,
    transport: 'stdio',
    version: 'test',
    guidesDir: guides,
    ...extra,
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'test', version: '0' })
  await client.connect(clientSide)
  return client
}

function text(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as { type: string; text?: string }[]
  return content[0]?.text ?? ''
}

describe('PerfAgent MCP server', () => {
  it('lists the read-only tools and no write tool by default', async () => {
    const client = await connect()
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'ai_report',
      'compare_runs',
      'explain_issue',
      'get_file_context',
      'list_issues',
      'open_dashboard',
      'scan_project',
      'scan_url',
      'suggest_fix',
    ])
  })

  it('registers apply_fix_to_branch only with allowWrites and a fix service', async () => {
    const fix = {
      start: () => Promise.reject(new Error('x')),
      get: () => undefined,
      list: () => [],
      accept: () => Promise.reject(new Error('x')),
      skip: () => Promise.reject(new Error('x')),
      undo: () => Promise.reject(new Error('x')),
    }
    const client = await connect({ allowWrites: true, fix })
    expect((await client.listTools()).tools.map((t) => t.name)).toContain('apply_fix_to_branch')
  })

  it('allows the write tool only in local mode', async () => {
    const repo = configSchema.parse({ root: here })
    expect(await writesAllowed({ config: repo, transport: 'stdio' })).toBe(true)
    expect(await writesAllowed({ config: repo, transport: 'http', host: '0.0.0.0' })).toBe(false)
    expect(await writesAllowed({ config: configSchema.parse({ root }), transport: 'stdio' })).toBe(
      false,
    ) // not a git repo
  })

  it('lists issues from the saved report with a chip filter', async () => {
    const client = await connect()
    const all = JSON.parse(text(await client.callTool({ name: 'list_issues', arguments: {} }))) as {
      count: number
      reportId: string
    }
    expect(all.reportId).toBe(fixtureId)
    expect(all.count).toBe(17)
    const lcp = JSON.parse(
      text(await client.callTool({ name: 'list_issues', arguments: { filter: 'metric:lcp' } })),
    ) as { count: number; issues: { metrics: string[] }[] }
    expect(lcp.count).toBeGreaterThan(0)
    expect(lcp.issues.every((i) => i.metrics.includes('lcp'))).toBe(true)
  })

  it('explains an issue with chain, gain, steps and before/after', async () => {
    const client = await connect()
    const issue = JSON.parse(
      text(
        await client.callTool({
          name: 'explain_issue',
          arguments: { issueId: 'general/lcp-image-lazy@src/components/HeroBanner.tsx:5' },
        }),
      ),
    ) as Record<string, unknown>
    expect(issue).toMatchObject({ title: 'Hero image is lazy-loaded', gain: { metric: 'lcp' } })
    expect(Array.isArray(issue.chain)).toBe(true)
    expect((issue.fix as { changes: unknown[] }).changes).toHaveLength(1)
  })

  it('rejects paths outside the root as an isError result', async () => {
    const client = await connect()
    const result = await client.callTool({
      name: 'get_file_context',
      arguments: { file: '../etc/passwd' },
    })
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('outside the project')
    const env = await client.callTool({ name: 'get_file_context', arguments: { file: '.env' } })
    expect(env.isError).toBe(true)
  })

  it('validates inputs with zod', async () => {
    const client = await connect()
    const result = await client.callTool({ name: 'scan_url', arguments: { url: 'not a url' } })
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('Invalid url')
  })

  it('reports no dashboard when server.json is absent and serves the latest report resource', async () => {
    const client = await connect()
    expect(
      JSON.parse(text(await client.callTool({ name: 'open_dashboard', arguments: {} }))),
    ).toMatchObject({ running: false })
    const resource = await client.readResource({ uri: 'perfagent://report/latest' })
    expect((resource.contents[0]?.text as string).length).toBeGreaterThan(1000)
    const guide = await client.readResource({ uri: 'perfagent://guide/lcp' })
    expect(guide.contents[0]?.mimeType).toBe('text/markdown')
    await expect(client.readResource({ uri: 'perfagent://guide/../secret' })).rejects.toThrow()
  })

  it('answers AI tools with a typed error when no AI is wired in', async () => {
    const client = await connect()
    const result = await client.callTool({ name: 'ai_report', arguments: {} })
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('AI_NOT_CONFIGURED')
  })
})
