import type { HistoryPoint, Report } from '@perfagent/core'
import { metricValue } from '@perfagent/core'
import { parseReport } from '@perfagent/report-schema'

import type { GuideDoc, GuideMeta, Status } from '../api/types'

import { DEMO_REPORT_URL, GUIDES_BASE } from './env'
import { convertLighthouse, isLighthouseJson } from './lighthouse'

/**
 * In-memory report store for the static website: the demo report plus
 * anything the visitor drops in or tests through PageSpeed Insights.
 */
const reports = new Map<string, Report>()

export async function loadDemoReport(): Promise<Report> {
  const existing = reports.get('demo')
  if (existing) return existing
  const response = await fetch(DEMO_REPORT_URL)
  if (!response.ok) throw new Error('The demo report could not be loaded')
  const report = parseReport(await response.json())
  reports.set('demo', { ...report, id: 'demo', label: 'Demo shop (sample scan)' })
  return reports.get('demo') as Report
}

export function addStaticReport(report: Report): Report {
  reports.set(report.id, report)
  return report
}

export function getStaticReport(id: string): Report | undefined {
  return reports.get(id)
}

export function listStaticReports(): HistoryPoint[] {
  return [...reports.values()].map((r) => ({
    reportId: r.id,
    at: r.createdAt,
    score: metricValue(r.pages[0]?.metrics ?? [], 'score') ?? 0,
    label: r.label,
  }))
}

/** Accepts PerfAgent JSON or a Lighthouse JSON result. Anything else is rejected with a plain message. */
export function importStaticJson(text: string, filename: string): Report {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`${filename} is not valid JSON`)
  }
  if (isLighthouseJson(data)) return addStaticReport(convertLighthouse(data))
  return addStaticReport(parseReport(data))
}

export function staticStatus(report: Report | undefined): Status {
  return {
    version: 'website',
    mode: 'static',
    modeReasons: ['Static website: nothing can be scanned or changed here'],
    project: {
      root: '',
      name: report?.label ?? 'Demo shop',
      framework: report?.build?.framework,
      frameworkVersion: report?.build?.frameworkVersion,
    },
    config: {
      urls: [],
      device: 'mobile',
      runs: 1,
      editor: 'auto',
      theme: 'system',
      language: 'en',
      aiProvider: 'none',
      environments: {},
    },
    editors: {},
    latestReportId: report?.id,
    capabilities: {
      scanProject: false,
      openEditor: false,
      applyFixes: false,
      ai: false,
      live: false,
    },
    options: [],
  }
}

export async function loadStaticGuides(): Promise<GuideMeta[]> {
  const response = await fetch(`${GUIDES_BASE}/index.json`)
  if (!response.ok) return []
  return (await response.json()) as GuideMeta[]
}

export async function loadStaticGuide(
  topic: string,
  language: string,
): Promise<GuideDoc | undefined> {
  const metas = await loadStaticGuides()
  const meta = metas.find((g) => g.topic === topic)
  if (!meta) return undefined
  const safe = topic.replace(/[^a-z0-9-]/gi, '')
  const localized =
    language === 'en'
      ? undefined
      : await fetch(`${GUIDES_BASE}/${safe}.${language}.md`)
          .then((r) => (r.ok ? r.text() : undefined))
          .catch(() => undefined)
  const english = await fetch(`${GUIDES_BASE}/${safe}.md`)
  const body: string = localized ?? (english.ok ? await english.text() : '')
  return { ...meta, body: stripFrontMatter(body) }
}

function stripFrontMatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '')
}
