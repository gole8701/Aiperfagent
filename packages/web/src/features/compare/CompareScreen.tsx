import {
  METRICS,
  compareReports,
  type Comparison,
  type HistoryPoint,
  type MetricDiff,
  type Report,
} from '@perfagent/core'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'

import { api, describeError } from '../../api/client'
import type { CompareResponse, CompareSource } from '../../api/types'
import type { ChartContext } from '../../charts/definitions'
import { readPalette } from '../../charts/palette'
import { Button } from '../../components/Button'
import { ErrorBox } from '../../components/Card'
import { Select } from '../../components/Fields'
import { Tabs } from '../../components/Tabs'
import { useFix } from '../../state/fix'
import { useReport } from '../../state/report'
import { useSettings } from '../../state/settings'
import { useDisplay } from '../../state/theme'
import { getStaticReport, listStaticReports } from '../../static/data'
import { IS_STATIC } from '../../static/env'
import { quickTest } from '../../static/psi'
import { FixRunView } from '../deep-dive/FixRunView'

import { DetectedValues } from './DetectedValues'
import { Result } from './Result'
import { SourceCard } from './Sources'
import { MODES, type CompareMode, type SourceSpec } from './types'
import './compare.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const BUDGET_KEYS: Partial<Record<MetricDiff['metric'], string>> = {
  lcp: 'lcp',
  inp: 'inp',
  cls: 'cls',
  ttfb: 'ttfb',
  tbt: 'tbt',
  score: 'score',
  jsKb: 'js',
  aiFirstTokenMs: 'aiFirstTokenMs',
}

export default function CompareScreen() {
  const { a, b } = useParams()
  const status = useReport((s) => s.status)
  const theme = useDisplay((s) => s.theme)
  const save = useSettings((s) => s.save)
  const startFix = useFix((s) => s.start)
  const [mode, setMode] = useState<CompareMode>('before-after')
  const [sources, setSources] = useState<SourceSpec[]>([{ kind: 'empty' }, { kind: 'empty' }])
  const [routes, setRoutes] = useState<{ a: string; b: string }>({ a: '', b: '' })
  const [scans, setScans] = useState<HistoryPoint[]>([])
  const [result, setResult] = useState<{ comparison: Comparison; reports: Report[] }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; hint?: string }>()
  const [notice, setNotice] = useState<string>()

  useEffect(() => {
    if (IS_STATIC) setScans(listStaticReports())
    else
      api
        .get<HistoryPoint[]>('/api/scans')
        .then(setScans)
        .catch(() => setScans([]))
  }, [])

  useEffect(() => {
    if (a && b)
      setSources([
        { kind: 'report', reportId: a, title: a },
        { kind: 'report', reportId: b, title: b },
      ])
  }, [a, b])

  const palette = useMemo(() => readPalette(), [theme])
  const pagesOf = (index: number): string[] => {
    const source = sources[index]
    if (source?.kind === 'file') return source.result.report.pages.map((p) => p.route)
    if (source?.kind === 'report')
      return (
        (IS_STATIC
          ? getStaticReport(source.reportId)
          : result?.reports.find((r) => r.id === source.reportId)
        )?.pages.map((p) => p.route) ?? []
      )
    return []
  }

  async function run(): Promise<void> {
    setBusy(true)
    setError(undefined)
    setResult(undefined)
    try {
      const ready = sources.filter((s) => s.kind !== 'empty')
      if (ready.length < 2) throw new Error('Pick at least two things to compare')
      const options =
        mode === 'page-vs-page'
          ? { routeA: routes.a || undefined, routeB: routes.b || undefined }
          : {}
      if (IS_STATIC) {
        const reports = await Promise.all(ready.map(resolveStatic))
        const [first, second] = reports
        if (!first || !second) throw new Error('Two sources are needed')
        setResult({ comparison: compareReports(first, second, options), reports })
      } else {
        const response = await api.post<CompareResponse>('/api/compare', {
          sources: ready.map(toServerSource),
          ...options,
        })
        const reports = await Promise.all(
          response.reports.map((r) => api.get<Report>(`/api/scans/${r.id}`)),
        )
        setResult({ comparison: response.comparison, reports })
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const reportB = result?.reports[1]
  const ctx: ChartContext | undefined = reportB
    ? { report: reportB, page: reportB.pages[0], history: [], expert: false, palette }
    : undefined
  const lowConfidence = sources.find(
    (s): s is Extract<SourceSpec, { kind: 'file' }> =>
      s.kind === 'file' && !s.result.exact && Boolean(s.result.detected?.length),
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Compare performance</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            Before vs after a change, one page vs another, or many pages at once. Any source: scans,
            dashboard links, URLs or files.
          </div>
        </div>
      </div>
      <Tabs
        label="Comparison type"
        active={mode}
        items={MODES}
        onChange={(id) => setMode(id as CompareMode)}
      />
      <div className="sources-row" data-tour="sources">
        {sources.map((source, index) => (
          <SourceCard
            key={index}
            label={`${LETTERS[index] ?? index}${index === 0 ? ' · Before' : index === 1 ? ' · After' : ''}`}
            source={source}
            scans={scans}
            onChange={(next) => setSources(sources.map((s, i) => (i === index ? next : s)))}
            onRemove={
              index >= 2 ? () => setSources(sources.filter((_, i) => i !== index)) : undefined
            }
          />
        ))}
        {sources.length < 5 ? (
          <Button
            onClick={() => setSources([...sources, { kind: 'empty' }])}
            style={{ alignSelf: 'center' }}
          >
            + Add {LETTERS[sources.length]}
          </Button>
        ) : null}
      </div>
      {mode === 'page-vs-page' ? (
        <div className="page-pickers" style={{ margin: '12px 0' }}>
          <Select
            label="Page from A"
            value={routes.a}
            options={[
              { value: '', label: 'First page' },
              ...pagesOf(0).map((r) => ({ value: r, label: r })),
            ]}
            onChange={(v) => setRoutes({ ...routes, a: v })}
          />
          <Select
            label="Page from B"
            value={routes.b}
            options={[
              { value: '', label: 'First page' },
              ...pagesOf(1).map((r) => ({ value: r, label: r })),
            ]}
            onChange={(v) => setRoutes({ ...routes, b: v })}
          />
        </div>
      ) : null}
      {lowConfidence ? (
        <div style={{ margin: '12px 0' }}>
          <DetectedValues
            result={lowConfidence.result}
            onCorrected={(fixed) =>
              setSources(sources.map((s) => (s === lowConfidence ? { ...s, result: fixed } : s)))
            }
          />
        </div>
      ) : null}
      <div className="row" style={{ margin: '12px 0' }}>
        <Button variant="primary" busy={busy} onClick={() => void run()} data-tour="run">
          Compare
        </Button>
        {notice ? <span className="rating-good">{notice}</span> : null}
      </div>
      {error ? <ErrorBox error={error} /> : null}
      {result && ctx ? (
        <Result
          comparison={result.comparison}
          mode={result.comparison.mode}
          ctx={ctx}
          canFix={Boolean(status?.capabilities.applyFixes)}
          onFixWorse={() => {
            const ids = result.comparison.impact
              .filter((i) => i.kind === 'new' && i.issue)
              .map((i) => i.issue?.id ?? '')
            void startFix(reportB?.id ?? '', { kind: 'issue', issueIds: ids }, { review: true })
          }}
          onBaseline={() => {
            if (IS_STATIC || !reportB)
              return setNotice('Baselines are saved by the installed tool.')
            api
              .post(`/api/scans/${reportB.id}/annotate`, { annotation: 'baseline' })
              .then(() => setNotice('Saved as the new baseline'))
              .catch((err: unknown) => setError(describeError(err)))
          }}
          onBudgets={(diffs) => {
            if (IS_STATIC) return setNotice('Budgets are saved by the installed tool.')
            const budgets: Record<string, Record<string, unknown>> = {}
            for (const d of diffs) {
              const key = BUDGET_KEYS[d.metric]
              if (!key || d.from === undefined) continue
              budgets[d.route] = {
                ...budgets[d.route],
                [key]:
                  d.metric === 'jsKb' ? `${Math.round(d.from)}kb` : Math.round(d.from * 100) / 100,
              }
            }
            save({ budgets })
              .then(() =>
                setNotice(
                  `Budgets added for ${diffs.map((d) => METRICS[d.metric].short).join(', ')}`,
                ),
              )
              .catch((err: unknown) => setError(describeError(err)))
          }}
        />
      ) : null}
      <FixRunView />
    </div>
  )
}

function toServerSource(source: SourceSpec): CompareSource {
  switch (source.kind) {
    case 'report':
      return { kind: 'report', reportId: source.reportId }
    case 'file':
      return { kind: 'report', reportId: source.result.reportId }
    case 'url':
      return { kind: 'url', url: source.url }
    case 'text':
      return { kind: 'text', text: source.text }
    case 'link':
      return { kind: 'link', url: source.url }
    default:
      throw new Error('Pick a source first')
  }
}

async function resolveStatic(source: SourceSpec): Promise<Report> {
  if (source.kind === 'report') {
    const report = getStaticReport(source.reportId)
    if (!report) throw new Error('That report is no longer loaded')
    return report
  }
  if (source.kind === 'file') return source.result.report
  if (source.kind === 'url') return quickTest(source.url)
  throw new Error('On the website, compare saved reports, dropped files or a quick URL test')
}
