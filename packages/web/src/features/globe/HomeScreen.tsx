import { AREAS, METRICS, formatMetric, metricValue, type ChipFilter, type Issue } from '@perfagent/core'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { Button, LinkButton } from '../../components/Button'
import { Card, Empty, ErrorBox, Spinner } from '../../components/Card'
import { ImportDrop } from '../../components/ImportDrop'
import { filterToString, parseFilter, useReport, visibleIssues } from '../../state/report'
import { IS_STATIC } from '../../static/env'
import { DeepDive } from '../deep-dive/DeepDive'

import { CornerCards } from './CornerCards'
import { LeftColumn } from './LeftColumn'
import { ProblemsTable, whereLabel } from './ProblemsTable'
import { layoutGlobe, type GlobePoint } from './layout'
import './globe.css'

const Globe = lazy(() => import('./Globe'))

export function HomeScreen() {
  const { report, status, loading, error, load, filter, setFilter, route } = useReport()
  const { id: issueParam } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedPoint, setSelectedPoint] = useState<GlobePoint>()

  const urlFilter = params.get('filter')
  useEffect(() => {
    const parsed = parseFilter(urlFilter)
    if (filterToString(parsed) !== filterToString(filter)) setFilter(parsed)
    // Only the URL drives the filter; the store mirrors it.
  }, [urlFilter])

  const issues = visibleIssues({ report, filter, route })
  const selectedIssue = issueParam ? report?.issues.find((i) => i.id === decodeURIComponent(issueParam)) : undefined
  const layout = useMemo(() => (report ? layoutGlobe({ tree: report.tree, page: report.pages[0], issues: report.issues }) : undefined), [report])
  const pointByIssue = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of layout?.points ?? []) if (p.kind === 'file') for (const id of p.issueIds) map.set(id, p.id)
    for (const p of layout?.points ?? []) if (p.kind === 'folder') for (const id of p.issueIds) if (!map.has(id)) map.set(id, p.id)
    return map
  }, [layout])
  const highlighted = useMemo(() => new Set(issues.map((i) => pointByIssue.get(i.id)).filter((id): id is string => Boolean(id))), [issues, pointByIssue])

  const changeFilter = useCallback(
    (next: ChipFilter) => {
      const value = filterToString(next)
      setParams(value === 'all' ? {} : { filter: value }, { replace: true })
    },
    [setParams],
  )

  const openIssue = useCallback(
    (issue: Issue | undefined) => {
      void navigate(issue ? `/issues/${encodeURIComponent(issue.id)}${params.toString() ? `?${params}` : ''}` : `/${params.toString() ? `?${params}` : ''}`)
    },
    [navigate, params],
  )

  const onPoint = useCallback(
    (point: GlobePoint | undefined) => {
      setSelectedPoint(point)
      if (!point) return openIssue(undefined)
      const first = issues.find((i) => point.issueIds.includes(i.id)) ?? report?.issues.find((i) => point.issueIds.includes(i.id))
      openIssue(first)
    },
    [issues, openIssue, report],
  )

  if (loading) {
    return (
      <div className="page">
        <Spinner label="Loading your latest scan" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="page">
        <ErrorBox error={error} action={<Button onClick={() => void load()}>Try again</Button>} />
      </div>
    )
  }
  if (!report || !layout) return <NoScanYet />

  const page = report.pages[0]
  const score = page ? (metricValue(page.metrics, 'score') ?? 0) : 0
  const filterLabel = filter.kind === 'all' ? 'all' : filter.kind === 'metric' ? METRICS[filter.id].short : (AREAS.find((a) => a.id === filter.id)?.label ?? filter.id)
  const selectedPointId = selectedIssue ? pointByIssue.get(selectedIssue.id) : selectedPoint?.id

  return (
    <div className="home">
      <LeftColumn report={report} filter={filter} onFilter={changeFilter} />
      <div className="home-centre">
        <div className="row muted" style={{ justifyContent: 'space-between', fontSize: 12 }}>
          <span>
            {layout.points.length} points · {report.issues.filter((i) => i.status === 'open').length} problems · showing: {filterLabel}
            {report.tree ? '' : ' · URL scan: domains and requests'}
          </span>
          <span>Drag to rotate · click a glowing point to go deep</span>
        </div>
        <Suspense fallback={<div className="globe" aria-busy="true" />}>
          <Globe
            layout={layout}
            selectedId={selectedPointId}
            highlighted={highlighted}
            filtering={filter.kind !== 'all'}
            onSelect={onPoint}
            scoreLabel={`score ${score}`}
            infoCard={selectedIssue ? { title: selectedIssue.plain, metric: `${METRICS[selectedIssue.gain.metric].short} ${formatMetric(selectedIssue.gain.metric, selectedIssue.gain.from)}`, where: whereLabel(selectedIssue) } : selectedPoint ? { title: selectedPoint.label, metric: selectedPoint.issueIds.length ? `${selectedPoint.issueIds.length} problems inside` : 'No problems found here', where: selectedPoint.path } : undefined}
          />
        </Suspense>
        <CornerCards report={report} />
        <Card className="option-card" data-tour="charts-link">
          <div>
            <strong>See all metrics as simple charts</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              Every problem and metric explained with easy charts in plain language. No technical knowledge needed.
            </div>
          </div>
          <div className="row">
            <LinkButton to="/charts/overview" variant="primary">
              Open charts view
            </LinkButton>
            <Link to="/flow">Flow diagram</Link>
            <Link to="/compare">Compare</Link>
          </div>
        </Card>
      </div>
      <div className="home-right" data-tour="right">
        <DeepDive issue={selectedIssue} point={selectedPoint} status={status} onClose={() => openIssue(undefined)} />
      </div>
      <ProblemsTable issues={issues} selectedId={selectedIssue?.id} onSelect={openIssue} filterLabel={filterLabel} />
    </div>
  )
}

function NoScanYet() {
  const useAsReport = useReport((s) => s.useReport)
  const status = useReport((s) => s.status)
  return (
    <div className="page">
      <Empty>
        <h1>Scan your project</h1>
        <p>
          {status?.capabilities.scanProject ? 'Press Scan in the top bar to measure your pages and find every problem down to the file and line.' : IS_STATIC ? 'Drop a report below or quick-test any URL from the top bar.' : 'Paste a URL in the top bar to test it, or import a report.'}
        </p>
        <div style={{ maxWidth: 520, margin: '20px auto' }}>
          <ImportDrop onImported={(result) => useAsReport(result.report)} />
        </div>
      </Empty>
    </div>
  )
}
