import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { LiveTick } from '../../api/types'
import { echarts, type EChartsOption } from '../../charts/echarts'
import { readPalette } from '../../charts/palette'
import { Button, CopyButton } from '../../components/Button'
import { Card, Empty, ErrorBox } from '../../components/Card'
import { Select } from '../../components/Fields'
import { useLive, type LiveWindow } from '../../state/live'
import { useReport } from '../../state/report'
import { useDisplay } from '../../state/theme'
import { IS_STATIC } from '../../static/env'
import './live.css'

const AGENT_SNIPPET = `<script src="http://127.0.0.1:4545/agent/perfagent.js" data-endpoint="http://127.0.0.1:4545/api/agent/collect" async></script>`
const AGENT_NPM = 'npm i @perfagent/agent'

export default function LiveScreen() {
  const status = useReport((s) => s.status)
  const {
    running,
    url,
    ticks,
    window: windowSeconds,
    peaks,
    recording,
    busy,
    error,
    start,
    stop,
    setWindow,
    sync,
  } = useLive()
  const [input, setInput] = useState(url || status?.config.urls[0] || '')
  const theme = useDisplay((s) => s.theme)
  const palette = useMemo(() => readPalette(), [theme])

  useEffect(() => {
    if (!IS_STATIC) void sync()
  }, [sync])

  if (IS_STATIC || !status?.capabilities.live) {
    return (
      <div className="page">
        <Empty>
          <h2>Live mode needs the installed tool</h2>
          <p>
            Run <code>npx perfagent</code> in your project, then open Live to watch requests,
            WebSocket traffic, peaks and memory in real time.
          </p>
        </Empty>
      </div>
    )
  }

  const visible = ticks.slice(-windowSeconds)
  const reconnectMarks = markIndices(
    visible,
    (t, i, all) => i > 0 && t.wsReconnects > (all[i - 1]?.wsReconnects ?? 0),
  )
  const peakMarks = markIndices(visible, (t) => Boolean(t.peak))
  const latest = visible[visible.length - 1]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Live</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            A browser we control streams every request, WebSocket frame and memory sample while the
            page runs.
          </div>
        </div>
        <div className="row no-print">
          <input
            className="input"
            type="url"
            aria-label="URL to watch live"
            placeholder="http://localhost:3000"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ width: 280 }}
            disabled={running}
          />
          {running ? (
            <Button variant="danger" busy={busy} onClick={() => void stop()}>
              Stop · record session
            </Button>
          ) : (
            <Button
              variant="primary"
              busy={busy}
              onClick={() => void start(input)}
              disabled={!input}
            >
              Start
            </Button>
          )}
          <Select
            label="Window"
            hideLabel
            value={String(windowSeconds)}
            options={[
              { value: '60', label: 'Last 1 min' },
              { value: '900', label: 'Last 15 min' },
            ]}
            onChange={(v) => setWindow(Number(v) as LiveWindow)}
          />
        </div>
      </div>
      {error ? <ErrorBox error={error} /> : null}
      {running ? (
        <div className="badge badge-critical" role="status" aria-live="polite">
          Live · {url} · {ticks.length} s recorded
        </div>
      ) : null}
      <div className="live-grid">
        <LiveChart
          title="Requests per second"
          subtitle="Red dots = peaks"
          series={[
            {
              name: 'requests/s',
              values: visible.map((t) => t.requestsPerSec),
              colour: palette.accent,
            },
          ]}
          marks={peakMarks}
          palette={palette}
        />
        <LiveChart
          title="p95 latency (ms)"
          subtitle="How long the slowest 5% of requests took"
          series={[
            { name: 'p95 ms', values: visible.map((t) => t.p95LatencyMs), colour: palette.warning },
          ]}
          marks={peakMarks}
          palette={palette}
        />
        <LiveChart
          title="WebSocket messages/s and bytes/s"
          subtitle="Vertical lines = reconnects"
          series={[
            {
              name: 'messages/s',
              values: visible.map((t) => t.wsMessagesPerSec),
              colour: palette.series[3] ?? palette.accent,
            },
            {
              name: 'KB/s',
              values: visible.map((t) => t.wsBytesPerSec / 1024),
              colour: palette.series[5] ?? palette.good,
            },
          ]}
          marks={reconnectMarks}
          markColour={palette.critical}
          palette={palette}
        />
        <LiveChart
          title="WebSocket round-trip (ms)"
          subtitle="Time between a frame sent and the next one received"
          series={[{ name: 'rtt ms', values: visible.map((t) => t.wsRttMs), colour: palette.good }]}
          palette={palette}
        />
        <LiveChart
          title="Memory (MB)"
          subtitle="A rising line means something is never cleaned up"
          series={[
            {
              name: 'MB',
              values: visible.map((t) => t.memoryMb),
              colour: palette.series[1] ?? palette.warning,
            },
          ]}
          palette={palette}
        />
        <Card title="Latest slowest requests">
          {latest?.slowest.length ? (
            <table className="table">
              <tbody>
                {latest.slowest.map((r) => (
                  <tr key={r.url}>
                    <td className="mono" style={{ wordBreak: 'break-all' }}>
                      {r.url}
                    </td>
                    <td>{Math.round(r.ms)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="muted">Nothing recorded yet.</span>
          )}
        </Card>
        <Card title={`Peak alerts (${peaks.length})`}>
          {peaks.length === 0 ? <span className="muted">No peaks so far.</span> : null}
          <ul style={{ margin: 0, paddingLeft: 18 }} aria-live="polite">
            {peaks
              .slice(-8)
              .reverse()
              .map((p, i) => (
                <li key={i}>
                  {new Date(p.at).toLocaleTimeString()} · {p.metric} {Math.round(p.value)}
                </li>
              ))}
          </ul>
        </Card>
        {recording ? (
          <Card title="Recorded session">
            {recording.stats?.clusters?.length ? (
              <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                {recording.stats.clusters.map((c) => (
                  <li key={c.label}>
                    <strong>{Math.round(c.share * 100)}% of slow seconds</strong> = {c.label} (
                    {c.reason})
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">
                No clusters found: slow moments did not share one cause.
              </span>
            )}
            {recording.reportId ? (
              <div className="row" style={{ marginTop: 8 }}>
                <Link
                  to={`/compare/${recording.reportId}/${status.latestReportId ?? recording.reportId}`}
                  className="btn"
                >
                  Compare this session
                </Link>
              </div>
            ) : null}
          </Card>
        ) : null}
        <Card title="Real users: install the agent" className="live-span">
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Live from your real visitors needs a tiny script on your site. It sends Web Vitals,
            fetch timings, WebSocket stats, long tasks and errors to this dashboard.
          </p>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <pre style={{ flex: 1 }}>{AGENT_SNIPPET}</pre>
            <CopyButton text={AGENT_SNIPPET} />
          </div>
          <div className="row" style={{ alignItems: 'flex-start', marginTop: 8 }}>
            <pre style={{ flex: 1 }}>{AGENT_NPM}</pre>
            <CopyButton text={AGENT_NPM} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function markIndices(
  ticks: LiveTick[],
  test: (t: LiveTick, i: number, all: LiveTick[]) => boolean,
): number[] {
  return ticks.map((t, i) => (test(t, i, ticks) ? i : -1)).filter((i) => i >= 0)
}

interface LiveChartProps {
  title: string
  subtitle: string
  series: { name: string; values: number[]; colour: string }[]
  marks?: number[]
  markColour?: string
  palette: ReturnType<typeof readPalette>
}

/** Streaming line chart: no animation, redrawn on every tick, at most 900 points. */
function LiveChart({ title, subtitle, series, marks = [], markColour, palette }: LiveChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts>(null)

  useEffect(() => {
    if (!ref.current) return
    chart.current = echarts.init(ref.current)
    const observer = new ResizeObserver(() => chart.current?.resize())
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      chart.current?.dispose()
    }
  }, [])

  useEffect(() => {
    const length = series[0]?.values.length ?? 0
    const option: EChartsOption = {
      animation: false,
      color: series.map((s) => s.colour),
      textStyle: { color: palette.text },
      grid: { left: 8, right: 12, top: 8, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: palette.panel,
        borderColor: palette.border,
        textStyle: { color: palette.text },
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length }, (_, i) => `${i - length + 1}s`),
        axisLabel: { color: palette.muted, interval: Math.max(0, Math.floor(length / 6)) },
        axisLine: { lineStyle: { color: palette.border } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: palette.muted },
        splitLine: { lineStyle: { color: palette.border } },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: 'line',
        data: s.values.map((v) => Math.round(v * 10) / 10),
        showSymbol: false,
        lineStyle: { width: 2 },
        markLine:
          i === 0 && marks.length
            ? {
                symbol: 'none',
                silent: true,
                data: marks.slice(-20).map((x) => ({ xAxis: x })),
                lineStyle: { color: markColour ?? palette.critical, width: 1 },
              }
            : undefined,
        markPoint:
          i === 0 && !markColour && marks.length
            ? {
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: palette.critical },
                data: marks.slice(-20).map((x) => ({ name: 'peak', coord: [x, s.values[x] ?? 0] })),
              }
            : undefined,
      })),
    }
    chart.current?.setOption(option, true)
  }, [series, marks, markColour, palette])

  return (
    <Card title={title}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
        {subtitle}
      </div>
      <div
        ref={ref}
        style={{ height: 180 }}
        role="img"
        aria-label={`${title}: ${series.map((s) => `${s.name} now ${Math.round(s.values[s.values.length - 1] ?? 0)}`).join(', ')}`}
      />
    </Card>
  )
}
