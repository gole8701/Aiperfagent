import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  PerfAgentError,
  metricValue,
  type HistoryPoint,
  type Issue,
  type IssueStatus,
  type Report,
} from '@perfagent/core'
import { parseReport } from '@perfagent/report-schema'

/**
 * Everything PerfAgent remembers lives in `<root>/.perfagent/` as JSON files:
 * reports, history, settings overrides and the AI audit log. Nothing leaves
 * the machine. The folder is git-ignored by `perfagent init`.
 */
export class ReportStore {
  readonly dir: string
  private readonly reportsDir: string

  constructor(root: string) {
    this.dir = path.join(root, '.perfagent')
    this.reportsDir = path.join(this.dir, 'reports')
  }

  async init(): Promise<void> {
    await mkdir(this.reportsDir, { recursive: true })
  }

  async save(report: Report): Promise<void> {
    await this.init()
    await writeFile(this.reportPath(report.id), JSON.stringify(report), 'utf8')
    const history = (await this.history()).filter((h) => h.reportId !== report.id)
    history.push(historyPoint(report.id, report))
    await writeFile(
      path.join(this.dir, 'history.json'),
      JSON.stringify(history.slice(-200)),
      'utf8',
    )
  }

  async get(id: string): Promise<Report> {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new PerfAgentError('NOT_FOUND', 'Invalid report id')
    try {
      return parseReport(JSON.parse(await readFile(this.reportPath(id), 'utf8')))
    } catch (error) {
      if (error instanceof PerfAgentError) throw error
      throw new PerfAgentError('NOT_FOUND', `Report ${id} was not found`, 'Run a scan first.')
    }
  }

  /** The newest project report; a URL scan of some other site never replaces it. Falls back to any report. */
  async latest(): Promise<Report | undefined> {
    const list = await this.list()
    const last = list.findLast((h) => !h.target) ?? list[list.length - 1]
    return last ? this.get(last.reportId) : undefined
  }

  async list(): Promise<HistoryPoint[]> {
    return this.history()
  }

  async delete(id: string): Promise<void> {
    await rm(this.reportPath(id), { force: true })
    const history = (await this.history()).filter((h) => h.reportId !== id)
    await writeFile(path.join(this.dir, 'history.json'), JSON.stringify(history), 'utf8')
  }

  async updateIssue(
    reportId: string,
    issueId: string,
    patch: Partial<Pick<Issue, 'status' | 'verified'>>,
  ): Promise<Issue> {
    const report = await this.get(reportId)
    const issue = report.issues.find((i) => i.id === issueId)
    if (!issue) throw new PerfAgentError('NOT_FOUND', `Problem ${issueId} is not in this report`)
    Object.assign(issue, patch)
    await writeFile(this.reportPath(reportId), JSON.stringify(report), 'utf8')
    return issue
  }

  async setIssueStatus(reportId: string, issueId: string, status: IssueStatus): Promise<Issue> {
    return this.updateIssue(reportId, issueId, { status })
  }

  async annotate(reportId: string, annotation: string): Promise<void> {
    const history = await this.history()
    const point = history.find((h) => h.reportId === reportId)
    if (point) point.annotation = annotation
    await writeFile(path.join(this.dir, 'history.json'), JSON.stringify(history), 'utf8')
  }

  async readJson<T>(name: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(path.join(this.dir, name), 'utf8')) as T
    } catch {
      return fallback
    }
  }

  async writeJson(name: string, value: unknown): Promise<void> {
    await this.init()
    await writeFile(path.join(this.dir, name), JSON.stringify(value, null, 2), 'utf8')
  }

  async appendLog(name: string, line: string): Promise<void> {
    await this.init()
    await writeFile(path.join(this.dir, name), `${new Date().toISOString()} ${line}\n`, {
      flag: 'a',
    })
  }

  private async history(): Promise<HistoryPoint[]> {
    const stored = await this.readJson<HistoryPoint[]>('history.json', [])
    // Older versions could append the same report twice; keep the last entry.
    if (stored.length) return [...new Map(stored.map((h) => [h.reportId, h])).values()]
    // Recover from report files if history.json is missing.
    const files = await readdir(this.reportsDir).catch(() => [])
    const points: HistoryPoint[] = []
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      const id = f.replace(/\.json$/, '')
      const report = await this.get(id).catch(() => undefined)
      // The file name is the id we can load again; a copied report may carry another id inside.
      if (report) points.push(historyPoint(id, report))
    }
    return points.sort((a, b) => a.at.localeCompare(b.at))
  }

  private reportPath(id: string): string {
    return path.join(this.reportsDir, `${id}.json`)
  }
}

function historyPoint(reportId: string, report: Report): HistoryPoint {
  const scores = report.pages
    .map((p) => metricValue(p.metrics, 'score'))
    .filter((v) => v !== undefined)
  const url = report.pages[0]?.url ?? report.environment.url
  return {
    reportId,
    at: report.createdAt,
    score: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : undefined,
    target: report.tree || !url ? undefined : hostOf(url),
    label: report.label,
  }
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host
  } catch {
    return undefined
  }
}
