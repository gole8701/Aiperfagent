import { buildRootCauseChain, issueId, metricValue, type Area, type ChainInput, type CodeChange, type DocLink, type Issue, type MetricId, type PageResult, type Severity, type SourceLocation } from '@perfagent/core'
import type { ProjectScan, SourceFile } from '@perfagent/scanner'

/**
 * A rule looks at the project scan (static) and/or page results (runtime)
 * and reports findings. The engine turns findings into full `Issue`s so every
 * rule gets the same deep-dive shape for free.
 */
export interface RuleContext {
  scan?: ProjectScan
  pages: PageResult[]
  /** Framework rule packs enabled for this project. */
  packs: string[]
}

export interface Finding {
  location?: SourceLocation
  route?: string
  severity?: Severity
  /** Overrides for the rule defaults when the evidence is specific. */
  title?: string
  plain?: string
  why?: string
  chain: ChainInput
  gain: { from: number; to: number; scoreDelta: number; note?: string }
  changes?: CodeChange[]
  steps?: string[]
  automatic?: boolean
  confidence?: number
  prevent?: { metric: MetricId; max: number }
}

export interface Rule {
  id: string
  pack: 'general' | 'react' | 'next' | 'realtime' | 'ai' | 'agents'
  title: string
  plain: string
  severity: Severity
  metrics: MetricId[]
  areas: Area[]
  why: string
  frameworkRule?: string
  docs: DocLink[]
  steps: string[]
  detect: (ctx: RuleContext) => Finding[]
}

export function runRules(rules: Rule[], ctx: RuleContext, disabled: string[] = []): Issue[] {
  const issues: Issue[] = []
  for (const rule of rules) {
    if (disabled.includes(rule.id) || !ctx.packs.includes(rule.pack)) continue
    for (const f of safeDetect(rule, ctx)) issues.push(toIssue(rule, f))
  }
  return dedupe(issues).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.gain.scoreDelta - a.gain.scoreDelta)
}

function safeDetect(rule: Rule, ctx: RuleContext): Finding[] {
  try {
    return rule.detect(ctx)
  } catch {
    // A broken rule must never take the whole scan down.
    return []
  }
}

function toIssue(rule: Rule, f: Finding): Issue {
  const route = f.route ?? firstRoute(f)
  return {
    id: issueId(rule.id, f.location?.file, f.location?.line, route),
    ruleId: rule.id,
    title: f.title ?? rule.title,
    plain: f.plain ?? rule.plain,
    severity: f.severity ?? rule.severity,
    metrics: rule.metrics,
    areas: rule.areas,
    route,
    location: f.location,
    chain: buildRootCauseChain(f.chain),
    why: f.why ?? rule.why,
    frameworkRule: rule.frameworkRule,
    gain: { metric: f.chain.metric, ...f.gain },
    fix: { steps: f.steps ?? rule.steps, changes: f.changes ?? [], automatic: f.automatic ?? false },
    prevent: f.prevent ? { route: route ?? '/', ...f.prevent } : undefined,
    docs: rule.docs,
    status: 'open',
    confidence: f.confidence ?? 0.85,
  }
}

function firstRoute(f: Finding): string | undefined {
  return f.chain.request ? undefined : undefined
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>()
  return issues.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}

export function severityRank(s: Severity): number {
  return { critical: 0, warning: 1, info: 2 }[s]
}

/* ---------- helpers shared by rule packs ---------- */

export function loc(file: SourceFile, line: number, symbol?: string, column?: number): SourceLocation {
  return { file: file.path, line, column, symbol }
}

export function lineText(file: SourceFile, line: number): string {
  return file.text.split('\n')[line - 1] ?? ''
}

export function snippet(file: SourceFile, line: number, around = 1): string {
  const lines = file.text.split('\n')
  return lines.slice(Math.max(0, line - 1 - around), line + around).join('\n')
}

export function pageMetric(pages: PageResult[], id: MetricId, route?: string): number | undefined {
  const page = route ? pages.find((p) => p.route === route) : pages[0]
  return page ? metricValue(page.metrics, id) : undefined
}

export function hasDep(scan: ProjectScan | undefined, name: string): boolean {
  return Boolean(scan && name in scan.packages)
}

export function replaceLine(file: SourceFile, line: number, after: string): CodeChange {
  return { file: file.path, before: lineText(file, line).trim(), after: after.trim() }
}
