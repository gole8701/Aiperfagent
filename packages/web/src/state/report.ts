import { attachIssues, countChips, matchesChip, type ChipFilter, type Issue, type IssueStatus, type Report } from '@perfagent/core'
import { create } from 'zustand'

import { api, describeError } from '../api/client'
import type { Status } from '../api/types'
import { addStaticReport, getStaticReport, loadDemoReport, staticStatus } from '../static/data'
import { IS_STATIC } from '../static/env'

export interface ScanProgress {
  jobId: string
  phase: string
  message: string
  fraction: number
  error?: string
}

interface ReportState {
  status?: Status
  report?: Report
  loading: boolean
  error?: { message: string; hint?: string }
  filter: ChipFilter
  route?: string
  selectedId?: string
  scan?: ScanProgress
  load: () => Promise<void>
  loadReport: (id: string) => Promise<void>
  useReport: (report: Report) => void
  setFilter: (filter: ChipFilter) => void
  setRoute: (route?: string) => void
  select: (id?: string) => void
  setIssueStatus: (id: string, status: IssueStatus) => Promise<void>
  setScan: (scan?: ScanProgress) => void
  patchIssue: (id: string, patch: Partial<Issue>) => void
}

/** Saved reports can carry a tree counted before every rule ran; recounting here keeps globe and flow badges in step with the issues. */
function normalise(report: Report): Report {
  return report.tree ? { ...report, tree: attachIssues(structuredClone(report.tree), report.issues) } : report
}

export const useReport = create<ReportState>((set, get) => ({
  loading: true,
  filter: { kind: 'all' },

  async load() {
    set({ loading: true, error: undefined })
    try {
      if (IS_STATIC) {
        const report = get().report ?? normalise(await loadDemoReport())
        set({ status: staticStatus(report), report, loading: false })
        return
      }
      const status = await api.get<Status>('/api/status')
      const report = status.latestReportId ? normalise(await api.get<Report>(`/api/scans/${status.latestReportId}`)) : undefined
      set({ status, report, loading: false })
    } catch (error) {
      set({ error: describeError(error), loading: false })
    }
  },

  async loadReport(id) {
    try {
      const raw = IS_STATIC ? getStaticReport(id) : await api.get<Report>(`/api/scans/${id}`)
      const report = raw ? normalise(raw) : undefined
      if (report) set({ report, selectedId: undefined, status: IS_STATIC ? staticStatus(report) : { ...get().status, latestReportId: id } as Status })
    } catch (error) {
      set({ error: describeError(error) })
    }
  },

  useReport(raw) {
    if (IS_STATIC) addStaticReport(raw)
    const report = normalise(raw)
    set({ report, selectedId: undefined, filter: { kind: 'all' }, status: IS_STATIC ? staticStatus(report) : get().status })
  },

  setFilter: (filter) => set({ filter }),
  setRoute: (route) => set({ route }),
  select: (selectedId) => set({ selectedId }),
  setScan: (scan) => set({ scan }),

  patchIssue(id, patch) {
    const report = get().report
    if (!report) return
    set({ report: { ...report, issues: report.issues.map((i) => (i.id === id ? { ...i, ...patch } : i)) } })
  },

  async setIssueStatus(id, status) {
    const { report, patchIssue } = get()
    if (!report) return
    if (!IS_STATIC) await api.post(`/api/issues/${encodeURIComponent(id)}/status?reportId=${report.id}`, { status })
    patchIssue(id, { status })
  },
}))

let cache: { report?: Report; filter: ChipFilter; route?: string; result: Issue[] } | undefined

/** Issues matching the current chip + page filter, sorted by estimated gain. Memoised: the globe and table ask on every render. */
export function visibleIssues(state: Pick<ReportState, 'report' | 'filter' | 'route'>): Issue[] {
  if (cache && cache.report === state.report && cache.filter === state.filter && cache.route === state.route) return cache.result
  const issues = state.report?.issues ?? []
  const result = issues
    .filter((i) => matchesChip(i, state.filter) && (!state.route || !i.route || i.route === state.route))
    .sort((a, b) => b.gain.scoreDelta - a.gain.scoreDelta)
  cache = { report: state.report, filter: state.filter, route: state.route, result }
  return result
}

export function chipCounts(report: Report | undefined): ReturnType<typeof countChips> {
  return countChips(report?.issues ?? [])
}

export function parseFilter(raw: string | null): ChipFilter {
  if (!raw || raw === 'all') return { kind: 'all' }
  const [kind, id] = raw.split(':')
  if (kind === 'metric' && id) return { kind: 'metric', id: id as Extract<ChipFilter, { kind: 'metric' }>['id'] }
  if (kind === 'area' && id) return { kind: 'area', id: id as Extract<ChipFilter, { kind: 'area' }>['id'] }
  return { kind: 'all' }
}

export function filterToString(filter: ChipFilter): string {
  return filter.kind === 'all' ? 'all' : `${filter.kind}:${filter.id}`
}

export function isLocalMode(status: Status | undefined): boolean {
  return status?.mode === 'local'
}
