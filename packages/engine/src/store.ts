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
    const history = await this.history()
    const score = report.pages.length
      ? Math.round(
          report.pages.reduce((s, p) => s + (metricValue(p.metrics, 'score') ?? 0), 0) /
            report.pages.length,
        )
      : 0
    history.push({ reportId: report.id, at: report.createdAt, score, label: report.label })
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

  async latest(): Promise<Report | undefined> {
    const list = await this.list()
    const last = list[list.length - 1]
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
    if (stored.length) return stored
    // Recover from report files if history.json is missing.
    const files = await readdir(this.reportsDir).catch(() => [])
    const points: HistoryPoint[] = []
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      const id = f.replace(/\.json$/, '')
      const report = await this.get(id).catch(() => undefined)
      // The file name is the id we can load again; a copied report may carry another id inside.
      if (report)
        points.push({
          reportId: id,
          at: report.createdAt,
          score: report.pages[0] ? (metricValue(report.pages[0].metrics, 'score') ?? 0) : 0,
          label: report.label,
        })
    }
    return points.sort((a, b) => a.at.localeCompare(b.at))
  }

  private reportPath(id: string): string {
    return path.join(this.reportsDir, `${id}.json`)
  }
}
