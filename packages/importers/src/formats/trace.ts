import type { LayoutShift, LongTask, RequestInfo } from '@perfagent/core'

import { emptyReport, pageFromMetrics } from '../report-builder.js'
import type { Importer } from '../types.js'

interface TraceEvent {
  name?: string
  ph?: string
  ts?: number
  dur?: number
  args?: { data?: Record<string, unknown>; frame?: string }
}

const asEvents = (json: unknown): TraceEvent[] | undefined => {
  const list = Array.isArray(json) ? json : (json as { traceEvents?: unknown } | null)?.traceEvents
  if (!Array.isArray(list)) return undefined
  const first = list.find((e) => typeof e === 'object' && e !== null) as TraceEvent | undefined
  return first && 'ph' in first && 'ts' in first ? (list as TraceEvent[]) : undefined
}

const LONG_TASK_US = 50_000

export const traceImporter: Importer = {
  format: 'trace',
  matches: (_input, json) => asEvents(json) !== undefined,
  run: (input, json) => Promise.resolve({ format: 'trace', report: fromTrace(asEvents(json) ?? [], input.filename ?? 'Chrome trace'), detected: [], warnings: [], exact: true }),
}

interface Pending { url?: string; type?: string; startUs: number; bytes: number; status: number; endUs?: number; mime?: string }

/** One pass over the events; timestamps are kept in µs and made relative to navigationStart at the end. */
function fromTrace(events: TraceEvent[], label: string): ReturnType<typeof emptyReport> {
  let navStart: number | undefined
  let pageUrl: string | undefined
  let fcpUs: number | undefined
  let lcpUs: number | undefined
  let cls = 0
  const shifts: { us: number; score: number }[] = []
  const tasks: { us: number; durUs: number }[] = []
  const pending = new Map<string, Pending>()
  let minTs = Infinity

  for (const e of events) {
    const data = e.args?.data ?? {}
    const ts = e.ts ?? 0
    if (ts < minTs) minTs = ts
    switch (e.name) {
      case 'navigationStart':
        if (navStart === undefined || data.isOutermostMainFrame === true || data.isLoadingMainFrame === true) {
          navStart = ts
          pageUrl = typeof data.documentLoaderURL === 'string' ? data.documentLoaderURL : pageUrl
        }
        break
      case 'firstContentfulPaint':
        fcpUs ??= ts
        break
      case 'largestContentfulPaint::Candidate':
        lcpUs = ts
        break
      case 'LayoutShift':
        if (data.had_recent_input !== true && typeof data.score === 'number') {
          cls += data.score
          shifts.push({ us: ts, score: data.score })
        }
        break
      case 'RunTask':
      case 'ThreadControllerImpl::RunTask':
        if ((e.dur ?? 0) > LONG_TASK_US) tasks.push({ us: ts, durUs: e.dur ?? 0 })
        break
      case 'ResourceSendRequest': {
        const id = idOf(data.requestId)
        if (id) pending.set(id, { url: str(data.url), type: str(data.resourceType), startUs: ts, bytes: 0, status: 0 })
        break
      }
      case 'ResourceReceiveResponse': {
        const p = pending.get(idOf(data.requestId))
        if (p) { p.status = Number(data.statusCode ?? 0); p.mime = str(data.mimeType) }
        break
      }
      case 'ResourceFinish': {
        const p = pending.get(idOf(data.requestId))
        if (p) { p.endUs = ts; p.bytes = Number(data.encodedDataLength ?? 0) }
        break
      }
      default:
        break
    }
  }

  const t0 = navStart ?? (minTs === Infinity ? 0 : minTs)
  const ms = (us: number): number => Math.max(0, Math.round((us - t0) / 100) / 10)
  const url = pageUrl ?? [...pending.values()][0]?.url ?? 'http://imported/'
  const longTasks: LongTask[] = tasks.map((t) => ({ startMs: ms(t.us), durationMs: t.durUs / 1000 })).slice(0, 2000)
  const tbt = tasks.filter((t) => fcpUs === undefined || t.us >= fcpUs).reduce((s, t) => s + (t.durUs - LONG_TASK_US) / 1000, 0)
  const layoutShifts: LayoutShift[] = shifts.map((s) => ({ value: s.score, timeMs: ms(s.us) })).slice(0, 2000)
  const requests: RequestInfo[] = [...pending.values()].slice(0, 5000).map((p) => ({
    url: p.url ?? '',
    type: resourceType(p.type, p.mime),
    transferBytes: p.bytes,
    startMs: ms(p.startUs),
    durationMs: p.endUs !== undefined ? Math.max(0, (p.endUs - p.startUs) / 1000) : 0,
    status: p.status,
    thirdParty: hostOf(p.url ?? '') !== hostOf(url),
    cached: false,
  }))
  const page = pageFromMetrics(url, {
    fcp: fcpUs !== undefined ? ms(fcpUs) : undefined,
    lcp: lcpUs !== undefined ? ms(lcpUs) : undefined,
    cls: shifts.length ? Math.round(cls * 1000) / 1000 : undefined,
    tbt: tasks.length ? Math.round(tbt) : undefined,
    requests: requests.length || undefined,
    transferKb: requests.length ? requests.reduce((s, r) => s + r.transferBytes, 0) / 1024 : undefined,
  }, 'mobile', requests)
  page.longTasks = longTasks
  page.layoutShifts = layoutShifts
  return emptyReport(label, { environment: { name: 'chrome-trace', url, device: 'mobile', browser: 'chromium', mode: 'imported' }, pages: [page] })
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const idOf = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')

function resourceType(kind: string | undefined, mime: string | undefined): RequestInfo['type'] {
  const k = (kind ?? '').toLowerCase()
  const m = (mime ?? '').toLowerCase()
  if (k === 'document' || m.includes('html')) return 'document'
  if (k === 'script' || m.includes('javascript')) return 'script'
  if (k === 'stylesheet' || m.includes('css')) return 'stylesheet'
  if (k === 'image' || m.startsWith('image/')) return 'image'
  if (k === 'font' || m.includes('font')) return 'font'
  if (k === 'xhr' || k === 'fetch' || m.includes('json')) return 'fetch'
  return 'other'
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
