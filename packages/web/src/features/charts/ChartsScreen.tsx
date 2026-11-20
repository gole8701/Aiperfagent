import type { HistoryPoint } from '@perfagent/core'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import { api } from '../../api/client'
import { Chart } from '../../charts/Chart'
import { CHARTS, CHART_TABS, type ChartContext, type ChartTab } from '../../charts/definitions'
import { readPalette } from '../../charts/palette'
import { Button } from '../../components/Button'
import { Empty, ErrorBox, Spinner } from '../../components/Card'
import { Select, Toggle } from '../../components/Fields'
import { Tabs } from '../../components/Tabs'
import { useReport } from '../../state/report'
import { useDisplay } from '../../state/theme'
import { listStaticReports } from '../../static/data'
import { IS_STATIC } from '../../static/env'
import './charts.css'

export default function ChartsScreen() {
  const { tab } = useParams()
  const { report, loading, error } = useReport()
  const theme = useDisplay((s) => s.theme)
  const [route, setRoute] = useState('')
  const [expert, setExpert] = useState(false)
  const [history, setHistory] = useState<HistoryPoint[]>([])

  useEffect(() => {
    if (IS_STATIC) {
      setHistory(listStaticReports())
      return
    }
    api
      .get<HistoryPoint[]>('/api/scans')
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [report?.id])

  const palette = useMemo(() => readPalette(), [theme])
  const ctx = useMemo<ChartContext | undefined>(() => {
    if (!report) return undefined
    const page = route ? report.pages.find((p) => p.route === route) : report.pages[0]
    return { report, page, route: route || undefined, history, expert, palette }
  }, [report, route, history, expert, palette])

  if (!tab || !CHART_TABS.some((t) => t.id === tab)) return <Navigate to="/charts/overview" replace />
  if (loading) {
    return (
      <div className="page">
        <Spinner label="Loading charts" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="page">
        <ErrorBox error={error} />
      </div>
    )
  }
  if (!report || !ctx) {
    return (
      <div className="page">
        <Empty>
          <h2>No scan yet</h2>
          <p>Scan your project or import a report; every chart is drawn from real scan data.</p>
        </Empty>
      </div>
    )
  }

  const charts = CHARTS[tab as ChartTab]
  return (
    <div className="page">
      <div className="page-head" data-tour="header">
        <div>
          <h1>Your performance in simple charts</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {report.label ?? report.environment.name} · {report.environment.device} · every chart says what it means in plain words · <Link to="/">Back to the globe</Link>
          </div>
        </div>
        <div className="row no-print">
          <Select label="Page" hideLabel value={route} options={[{ value: '', label: 'All pages' }, ...report.pages.map((p) => ({ value: p.route, label: p.route }))]} onChange={setRoute} />
          <Toggle label="Expert mode" checked={expert} onChange={setExpert} />
          <Button onClick={() => window.print()}>Export charts (PDF)</Button>
        </div>
      </div>
      <Tabs label="Chart groups" active={tab} items={CHART_TABS.map((t) => ({ id: t.id, label: `${t.label} · ${CHARTS[t.id].length}`, to: `/charts/${t.id}` }))} />
      <div className="charts-grid">
        {charts.map((definition) => (
          <Chart key={definition.id} definition={definition} ctx={ctx} />
        ))}
      </div>
    </div>
  )
}
