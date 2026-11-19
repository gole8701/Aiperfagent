import { launchBrowser, measurePage } from '@perfagent/collectors'
import type { PerfAgentConfig } from '@perfagent/config'
import { attachIssues, shortId, type Environment, type Issue, type PageResult, type Report, type SourceLocation } from '@perfagent/core'
import { detectIssues, packsFor } from '@perfagent/rules'
import { scanProject, scanOptionsFromConfig, type ProjectScan } from '@perfagent/scanner'
import { assertUrlAllowed, redact } from '@perfagent/security'

import { gitInfo } from './git.js'
import { PERFAGENT_VERSION } from './version.js'

export interface ScanRequest {
  urls?: string[]
  /** Scan source files; off for "paste any URL" mode. */
  project?: boolean
  device?: 'mobile' | 'desktop'
  runs?: number
  label?: string
  environmentName?: string
  mode?: Environment['mode']
  coverage?: boolean
  /** Hosted instances must not reach private networks. Local mode allows localhost. */
  allowLoopback?: boolean
}

export type ScanPhase = 'project' | 'browser' | 'rules' | 'done'

export interface ScanProgress {
  phase: ScanPhase
  message: string
  /** 0–1 */
  fraction: number
}

export interface ScanContext {
  config: PerfAgentConfig
  onProgress?: (progress: ScanProgress) => void
}

/** The whole pipeline: project scan → browser measurement → rules → report. */
export async function runScan(request: ScanRequest, ctx: ScanContext): Promise<Report> {
  const { config } = ctx
  const progress = ctx.onProgress ?? (() => undefined)
  const urls = request.urls ?? config.urls
  const wantProject = request.project ?? true

  let scan: ProjectScan | undefined
  if (wantProject) {
    progress({ phase: 'project', message: 'Reading project files', fraction: 0.02 })
    scan = await scanProject({ ...scanOptionsFromConfig(config), onProgress: (done, total) => progress({ phase: 'project', message: `Parsed ${done} of ${total} files`, fraction: 0.02 + 0.18 * (done / Math.max(1, total)) }) })
  }

  const pages: PageResult[] = []
  if (urls.length) {
    for (const url of urls) await assertUrlAllowed(url, { allowLoopback: request.allowLoopback ?? true })
    progress({ phase: 'browser', message: 'Starting browser', fraction: 0.22 })
    const browser = await launchBrowser(config.browser)
    try {
      for (const [i, url] of urls.entries()) {
        const runs = request.runs ?? config.runs
        pages.push(
          await measurePage(browser, {
            url,
            device: request.device ?? config.device,
            runs,
            coverage: request.coverage ?? true,
            projectFiles: scan ? new Set(scan.files.map((f) => f.path)) : undefined,
            onProgress: (run, total) => progress({ phase: 'browser', message: `Measuring ${url} (run ${run} of ${total})`, fraction: 0.22 + 0.6 * ((i + run / total) / urls.length) }),
          }),
        )
      }
    } finally {
      await browser.close().catch(() => undefined)
    }
  }

  progress({ phase: 'rules', message: 'Finding problems', fraction: 0.85 })
  const packs = packsFor(scan?.framework, config.rules.packs)
  const issues = detectIssues({ scan, pages, packs }, config.rules.disable)
  if (scan) attachIssues(scan.tree, issues)
  const build = scan ? { ...scan.build, ...(await gitInfo(config.root)) } : await gitInfo(config.root)

  const report: Report = {
    schemaVersion: 1,
    tool: { name: 'perfagent', version: PERFAGENT_VERSION },
    id: shortId('scan'),
    createdAt: new Date().toISOString(),
    environment: { name: request.environmentName ?? 'local', url: urls[0], device: request.device ?? config.device, browser: config.browser, mode: request.mode ?? 'local' },
    build,
    pages,
    issues,
    tree: scan?.tree,
    ai: scan ? { calls: [], callSites: aiCallSites(issues), models: [] } : undefined,
    readiness: readinessFrom(pages[0]),
    label: request.label,
  }
  progress({ phase: 'done', message: `Found ${issues.length} problems`, fraction: 1 })
  return redact(report)
}

/** Re-measures one route after a fix and records predicted vs actual on the issue. */
export async function retestIssue(report: Report, issue: Issue, ctx: ScanContext): Promise<{ page: PageResult; issue: Issue }> {
  const page = report.pages.find((p) => p.route === issue.route) ?? report.pages[0]
  if (!page) throw new Error('No measured page to re-test')
  const browser = await launchBrowser(ctx.config.browser)
  try {
    const fresh = await measurePage(browser, { url: page.url, device: page.device, runs: 3, coverage: false, readiness: false })
    const actual = fresh.metrics.find((m) => m.id === issue.gain.metric)?.value ?? issue.gain.from
    const verified = { metric: issue.gain.metric, predicted: issue.gain.to, actual, at: new Date().toISOString() }
    return { page: fresh, issue: { ...issue, verified } }
  } finally {
    await browser.close().catch(() => undefined)
  }
}

function aiCallSites(issues: Issue[]): SourceLocation[] {
  const seen = new Set<string>()
  const sites: SourceLocation[] = []
  for (const issue of issues) {
    if (!issue.areas.includes('ai') || !issue.location) continue
    const key = `${issue.location.file}:${issue.location.line}`
    if (seen.has(key)) continue
    seen.add(key)
    sites.push(issue.location)
  }
  return sites
}

function readinessFrom(page: PageResult | undefined): Report['readiness'] {
  const f = page?.features
  if (!f || typeof f.agentReadiness !== 'number') return undefined
  const notes: string[] = []
  if (!f.hasLlmsTxt) notes.push('No /llms.txt found')
  if (!f.hasStructuredData) notes.push('No structured data (JSON-LD)')
  if (Number(f.interactiveWithoutName) > 0) notes.push(`${String(f.interactiveWithoutName)} buttons/links/inputs without a name`)
  return { score: f.agentReadiness, missingLabels: Number(f.missingLabels ?? 0), interactiveWithoutName: Number(f.interactiveWithoutName ?? 0), hasLlmsTxt: Boolean(f.hasLlmsTxt), hasStructuredData: Boolean(f.hasStructuredData), pageTokens: Number(f.pageTokens ?? 0), notes }
}
