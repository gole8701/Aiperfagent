import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { PerfAgentError, compareReports, isPerfAgentError, matchesChip, type Area, type Issue, type MetricId, type Report } from '@perfagent/core'
import { gatherContext, runScan, type FixEvent } from '@perfagent/engine'
import { guardPath, redactText } from '@perfagent/security'
import { z } from 'zod'

import type { McpServerOptions } from './index.js'

const issueId = z.string().min(1).max(300)
const reportId = z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Report id; the latest report when omitted')

export function buildMcpServer(options: McpServerOptions): McpServer {
  const { config, store } = options
  const server = new McpServer({ name: 'perfagent', version: options.version })
  // A server reachable from other machines must not be used to probe its host's private network.
  const localOnly = options.transport === 'stdio' || (options.host ?? '127.0.0.1') === '127.0.0.1'

  async function report(id?: string): Promise<Report> {
    const found = id ? await store.get(id) : await store.latest()
    if (!found) throw new PerfAgentError('NOT_FOUND', 'No report yet', 'Run scan_project or scan_url first.')
    return found
  }

  function issueIn(r: Report, id: string): Issue {
    const issue = r.issues.find((i) => i.id === id)
    if (!issue) throw new PerfAgentError('NOT_FOUND', `Problem ${id} is not in report ${r.id}`)
    return issue
  }

  function ai(): NonNullable<McpServerOptions['ai']> {
    if (!options.ai) throw new PerfAgentError('AI_NOT_CONFIGURED', 'No AI service in this MCP server')
    return options.ai
  }

  server.registerTool('scan_url', { description: 'Measure any public URL (Core Web Vitals, requests, long tasks) and list the problems found. Read-only.', inputSchema: { url: z.string().url(), device: z.enum(['mobile', 'desktop']).optional(), runs: z.number().int().min(1).max(5).optional() }, annotations: { readOnlyHint: true, openWorldHint: true } }, guarded(async ({ url, device, runs }) => {
    const r = await runScan({ urls: [url], project: false, device, runs, mode: 'deployed', allowLoopback: localOnly }, { config })
    await store.save(r)
    return { reportId: r.id, pages: r.pages.map(pageSummary), issues: r.issues.map(issueSummary) }
  }))

  server.registerTool('scan_project', { description: 'Scan the project source (and its configured URLs) for performance problems with file:line locations. Saves a report.', inputSchema: { urls: z.array(z.string().url()).max(20).optional() }, annotations: { readOnlyHint: true } }, guarded(async ({ urls }) => {
    const r = await runScan({ urls: urls ?? config.urls, project: true, allowLoopback: true }, { config })
    await store.save(r)
    return { reportId: r.id, framework: r.build?.framework, pages: r.pages.map(pageSummary), issues: r.issues.map(issueSummary) }
  }))

  server.registerTool('list_issues', { description: 'Problems in a report, optionally filtered by chip ("metric:lcp", "area:bundle") or route.', inputSchema: { reportId, filter: z.string().regex(/^(metric|area):[a-zA-Z-]+$/).optional(), route: z.string().optional() }, annotations: { readOnlyHint: true } }, guarded(async ({ reportId: id, filter, route }) => {
    const r = await report(id)
    let issues = r.issues
    if (filter) {
      const [kind, value] = filter.split(':') as ['metric' | 'area', string]
      issues = issues.filter((i) => matchesChip(i, kind === 'metric' ? { kind, id: value as MetricId } : { kind, id: value as Area }))
    }
    if (route) issues = issues.filter((i) => i.route === route)
    return { reportId: r.id, count: issues.length, issues: issues.map(issueSummary) }
  }))

  server.registerTool('explain_issue', { description: 'Root-cause chain, why it matters, framework rule, expected gain, fix steps with before/after code and docs for one problem.', inputSchema: { issueId, reportId, useAi: z.boolean().optional().describe('Also ask the configured AI for a deeper explanation') }, annotations: { readOnlyHint: true } }, guarded(async ({ issueId: id, reportId: rid, useAi }) => {
    const r = await report(rid)
    const issue = issueIn(r, id)
    const { status, confidence, ...rest } = issue
    const out: Record<string, unknown> = { ...rest, status, confidence }
    if (useAi && options.ai && (await options.ai.activeProvider()) !== 'rules') {
      const files = await gatherContext(config.root, [issue], config.ai.sendCode)
      out.aiExplanation = await options.ai.explain(issue, files)
    }
    return out
  }))

  server.registerTool('get_file_context', { description: 'A window of a project file around a line (secrets redacted; only files inside the project root).', inputSchema: { file: z.string().min(1).max(1000), line: z.number().int().min(1).optional(), radius: z.number().int().min(1).max(200).optional() }, annotations: { readOnlyHint: true } }, guarded(async ({ file, line = 1, radius = 30 }) => {
    const guardedPath = await guardPath(config.root, file)
    const lines = (await readFile(guardedPath.absolute, 'utf8')).split('\n')
    const start = Math.max(0, line - 1 - radius)
    const end = Math.min(lines.length, line + radius)
    return { file: guardedPath.relative, from: start + 1, to: end, text: redactText(lines.slice(start, end).map((l, i) => `${String(start + i + 1).padStart(4)}| ${l}`).join('\n')) }
  }))

  server.registerTool('suggest_fix', { description: 'Ask the configured AI for code changes for one or more problems. Returns text only; nothing is applied.', inputSchema: { issueIds: z.array(issueId).min(1).max(10), reportId }, annotations: { readOnlyHint: true } }, guarded(async ({ issueIds, reportId: rid }) => {
    const r = await report(rid)
    const issues = issueIds.map((id) => issueIn(r, id))
    const files = await gatherContext(config.root, issues, config.ai.sendCode)
    return { changes: await ai().proposeFix(issues, files), note: 'Proposed only. Apply through your own editor or approval flow.' }
  }))

  server.registerTool('compare_runs', { description: 'Compare two reports (before/after): metric diffs, fixed and new problems, verdict.', inputSchema: { a: z.string().regex(/^[a-zA-Z0-9_-]+$/), b: z.string().regex(/^[a-zA-Z0-9_-]+$/) }, annotations: { readOnlyHint: true } }, guarded(async ({ a, b }) => compareReports(await store.get(a), await store.get(b))))

  server.registerTool('ai_report', { description: 'AI performance of the project: calls measured by watchAI/proxy, per-model first-token p50/p95, cost and error rate.', inputSchema: {}, annotations: { readOnlyHint: true } }, guarded(() => ai().report()))

  server.registerTool('open_dashboard', { description: 'URL of the running local dashboard, if any.', inputSchema: {}, annotations: { readOnlyHint: true } }, guarded(async () => {
    const running = await store.readJson<{ url?: string; port?: number; startedAt?: string } | null>('server.json', null)
    return running?.url ? { running: true, ...running } : { running: false, hint: 'Run "npx perfagent" to start the dashboard.' }
  }))

  if (options.allowWrites && options.fix) {
    const fix = options.fix
    server.registerTool('apply_fix_to_branch', { description: 'WRITE tool: applies fixes for the given problems on a new perfagent/fix-<date> git branch (never main, never pushed), runs the project checks and reports the result. Ask the user before each use.', inputSchema: { reportId: z.string().regex(/^[a-zA-Z0-9_-]+$/), issueIds: z.array(issueId).min(1).max(20), review: z.literal(false).optional() }, annotations: { readOnlyHint: false, destructiveHint: true } }, guarded(async ({ reportId: rid, issueIds }) => {
      const events: FixEvent[] = []
      const started = await fix.start({ reportId: rid, scope: { kind: 'issue', issueIds }, review: false }, (e) => events.push(e))
      const run = fix.wait ? await fix.wait(started.id) : started
      const done = run.events.find((e) => e.type === 'done')
      return { runId: run.id, status: run.status, branch: run.branch, summary: done?.type === 'done' ? done.summary : undefined, events: run.events.filter((e) => e.type !== 'proposal') }
    }))
  }

  server.registerResource('latest-report', 'perfagent://report/latest', { description: 'The most recent PerfAgent report as JSON', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await report()) }] }))
  server.registerResource('guide', new ResourceTemplate('perfagent://guide/{topic}', { list: undefined }), { description: 'Built-in guide page for a metric or feature (e.g. lcp, inp, bundle, chips)', mimeType: 'text/markdown' }, async (uri, variables) => {
    const topic = String(variables.topic)
    if (!options.guidesDir || !/^[a-z0-9-]+$/.test(topic)) throw new PerfAgentError('NOT_FOUND', `No guide "${topic}"`)
    const text = await readFile(path.join(options.guidesDir, `${topic}.md`), 'utf8').catch(() => { throw new PerfAgentError('NOT_FOUND', `No guide "${topic}"`) })
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] }
  })

  return server
}

/** Every tool answers JSON text; PerfAgent errors become `isError` results with the hint, never a protocol failure. */
function guarded<A>(fn: (args: A) => unknown): (args: A) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await fn(args), null, 2) }] }
    } catch (error) {
      const message = isPerfAgentError(error) ? `${error.message}${error.hint ? ` ${error.hint}` : ''} (${error.code})` : error instanceof Error ? error.message : String(error)
      return { content: [{ type: 'text', text: message }], isError: true }
    }
  }
}

function issueSummary(i: Issue): Record<string, unknown> {
  return { id: i.id, title: i.title, plain: i.plain, severity: i.severity, status: i.status, metrics: i.metrics, areas: i.areas, route: i.route, location: i.location, gain: i.gain, automaticFix: i.fix.automatic }
}

function pageSummary(p: Report['pages'][number]): Record<string, unknown> {
  return { route: p.route, url: p.url, device: p.device, metrics: Object.fromEntries(p.metrics.map((m) => [m.id, m.value])) }
}
