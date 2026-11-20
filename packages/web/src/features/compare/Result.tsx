import { METRICS, formatMetric, type Comparison, type MetricDiff } from '@perfagent/core'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { Chart } from '../../charts/Chart'
import type { ChartContext, ChartDefinition } from '../../charts/definitions'
import { axisStyle, baseOption } from '../../charts/definitions/helpers'
import { Button, CopyButton, LinkButton } from '../../components/Button'
import { Card } from '../../components/Card'
import { Toggle } from '../../components/Fields'

import { comparisonToMarkdown } from './markdown'
import type { CompareMode } from './types'

interface ResultProps {
  comparison: Comparison
  mode: CompareMode
  ctx: ChartContext
  canFix: boolean
  onFixWorse: () => void
  onBaseline: () => void
  onBudgets: (diffs: MetricDiff[]) => void
}

const DIRECTION_ICON = { better: '✅', worse: '❌', same: '➖' }
const KIND_LABEL = {
  fixed: 'Fixed',
  new: 'New problem',
  'still-open': 'Still open',
  request: 'New download',
  unknown: 'Unknown',
}

export function Result({
  comparison,
  mode,
  ctx,
  canFix,
  onFixWorse,
  onBaseline,
  onBudgets,
}: ResultProps) {
  const [worseOnly, setWorseOnly] = useState(false)
  const [a, b] = comparison.sources
  const diffs = useMemo(
    () => comparison.diffs.filter((d) => !worseOnly || d.direction === 'worse'),
    [comparison, worseOnly],
  )
  const worse = comparison.diffs.filter((d) => d.direction === 'worse')
  const impact = comparison.impact.filter(
    (i) => !worseOnly || i.kind === 'new' || i.kind === 'still-open',
  )
  const chart = useMemo(
    () =>
      pairedBars(
        diffs.filter((d) => mode !== 'many-pages' || d.route === comparison.diffs[0]?.route),
        a?.label ?? 'A',
        b?.label ?? 'B',
      ),
    [diffs, mode, comparison, a, b],
  )
  const markdown = comparisonToMarkdown(comparison)

  return (
    <div className="stack" id="compare-result">
      <Card>
        <div className="verdict">
          <div className="verdict-score">
            <span className="muted">{a?.label}</span>
            <strong>{comparison.verdict.scoreFrom}</strong>
            <span aria-hidden="true">→</span>
            <span className="muted">{b?.label}</span>
            <strong
              className={
                comparison.verdict.scoreTo >= comparison.verdict.scoreFrom
                  ? 'rating-good'
                  : 'rating-poor'
              }
            >
              {comparison.verdict.scoreTo}
            </strong>
          </div>
          <div>
            <div className="label">In simple words</div>
            {comparison.verdict.sentences.map((s, i) => (
              <p key={i} style={{ margin: '4px 0' }}>
                {s}
              </p>
            ))}
          </div>
        </div>
        {comparison.warnings.map((w) => (
          <div
            key={w}
            className="badge badge-warning"
            style={{ marginTop: 6, whiteSpace: 'normal' }}
          >
            Fairness: {w}
          </div>
        ))}
      </Card>

      {mode === 'many-pages' ? <PagesGrid diffs={comparison.diffs} /> : null}

      <div className="row no-print" style={{ justifyContent: 'flex-end' }}>
        <Toggle label="Show only what got worse" checked={worseOnly} onChange={setWorseOnly} />
      </div>
      <Chart definition={chart} ctx={ctx} />

      <Card title="Where is the impact?">
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          Each change that moved the numbers, the file it came from, and what to do.
        </div>
        {impact.length === 0 ? (
          <span className="muted">Nothing to show for this filter.</span>
        ) : null}
        <div className="stack" style={{ gap: 8 }}>
          {impact.map((item, index) => (
            <div key={index} className="impact-row">
              <span aria-hidden="true">
                {item.kind === 'fixed' ? '✅' : item.kind === 'unknown' ? '❔' : '❌'}
              </span>
              <div style={{ flex: 1 }}>
                <strong>{item.plain}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  <span className="badge" style={{ marginRight: 6 }}>
                    {KIND_LABEL[item.kind]}
                  </span>
                  {item.effect}
                  {item.issue?.location ? (
                    <span className="mono">
                      {' '}
                      · {item.issue.location.file}:{item.issue.location.line}
                    </span>
                  ) : null}
                </div>
              </div>
              {item.issue ? (
                <LinkButton small to={`/issues/${encodeURIComponent(item.issue.id)}`}>
                  {item.kind === 'fixed' ? 'See details' : 'Fix this'}
                </LinkButton>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title="What to do next">
        <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
          {comparison.nextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <div className="row no-print">
          {canFix ? (
            <Button
              variant="ai"
              onClick={onFixWorse}
              disabled={!comparison.impact.some((i) => i.kind === 'new' && i.issue)}
            >
              Fix what got worse with my AI
            </Button>
          ) : null}
          <Button onClick={onBaseline}>Save as new baseline</Button>
          <Button onClick={() => onBudgets(worse)} disabled={worse.length === 0}>
            Add budgets for these metrics
          </Button>
        </div>
      </Card>

      <div className="row no-print" aria-label="Export comparison">
        <span className="label">Export comparison</span>
        <Button small onClick={() => window.print()}>
          PDF
        </Button>
        <Button
          small
          onClick={() => {
            void import('html-to-image').then(async ({ toPng }) => {
              const el = document.getElementById('compare-result')
              if (!el) return
              const link = document.createElement('a')
              link.href = await toPng(el, { backgroundColor: ctx.palette.panel })
              link.download = 'perfagent-compare.png'
              link.click()
            })
          }}
        >
          PNG
        </Button>
        <CopyButton text={markdown} label="Markdown for PR comment" />
        <Link to="/guide/compare" style={{ fontSize: 12 }}>
          How to read this
        </Link>
      </div>
    </div>
  )
}

function PagesGrid({ diffs }: { diffs: MetricDiff[] }) {
  const routes = [...new Set(diffs.map((d) => d.route))]
  const metrics = (['score', 'lcp', 'inp', 'cls'] as const).filter((m) =>
    diffs.some((d) => d.metric === m),
  )
  return (
    <Card title="Every page, before → after">
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        Green = got better, red = got worse, grey = no real change.
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Page</th>
              {metrics.map((m) => (
                <th key={m} scope="col">
                  {METRICS[m].plain} ({METRICS[m].short})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route}>
                <td className="mono">{route}</td>
                {metrics.map((m) => {
                  const d = diffs.find((x) => x.route === route && x.metric === m)
                  if (!d) return <td key={m}>—</td>
                  return (
                    <td
                      key={m}
                      className={
                        d.direction === 'better'
                          ? 'rating-good'
                          : d.direction === 'worse'
                            ? 'rating-poor'
                            : 'muted'
                      }
                    >
                      {DIRECTION_ICON[d.direction]}{' '}
                      {d.from === undefined ? '—' : formatMetric(m, d.from)} →{' '}
                      {d.to === undefined ? '—' : formatMetric(m, d.to)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function pairedBars(diffs: MetricDiff[], labelA: string, labelB: string): ChartDefinition {
  return {
    id: 'compare-paired',
    kind: 'echarts',
    question: `Metric by metric: ${labelA} vs ${labelB}`,
    howToRead: `Top bar = ${labelA}, bottom bar = ${labelB}. Shorter is better, except for the score.`,
    guide: 'compare',
    height: Math.max(200, diffs.length * 46),
    build: (ctx) => {
      const p = ctx.palette
      const rows = diffs.filter((d) => d.from !== undefined && d.to !== undefined)
      const scaleOf = (d: MetricDiff): number => Math.max(d.from ?? 0, d.to ?? 0) || 1
      return {
        ...baseOption(p),
        legend: { bottom: 0, textStyle: { color: p.text } },
        grid: { left: 12, right: 120, top: 8, bottom: 30, containLabel: true },
        xAxis: { type: 'value', max: 1, show: false },
        yAxis: {
          type: 'category',
          inverse: true,
          data: rows.map((d) =>
            ctx.expert
              ? `${METRICS[d.metric].short} · ${d.route}`
              : `${METRICS[d.metric].plain} (${METRICS[d.metric].short})`,
          ),
          ...axisStyle(p),
          axisLabel: { color: p.text, width: 240, overflow: 'break' },
        },
        series: [
          {
            name: labelA,
            type: 'bar',
            data: rows.map((d) => (d.from ?? 0) / scaleOf(d)),
            itemStyle: { color: p.muted },
            barGap: '10%',
            barMaxWidth: 14,
            label: {
              show: true,
              position: 'right',
              color: p.muted,
              formatter: (x: { dataIndex: number }) =>
                formatMetric(rows[x.dataIndex]?.metric ?? 'score', rows[x.dataIndex]?.from ?? 0),
            },
          },
          {
            name: labelB,
            type: 'bar',
            barMaxWidth: 14,
            data: rows.map((d) => ({
              value: (d.to ?? 0) / scaleOf(d),
              itemStyle: {
                color:
                  d.direction === 'better'
                    ? p.good
                    : d.direction === 'worse'
                      ? p.critical
                      : p.accent,
              },
            })),
            label: {
              show: true,
              position: 'right',
              color: p.text,
              formatter: (x: { dataIndex: number }) =>
                `${formatMetric(rows[x.dataIndex]?.metric ?? 'score', rows[x.dataIndex]?.to ?? 0)} · ${rows[x.dataIndex]?.label ?? ''}`,
            },
          },
        ],
      }
    },
    takeaway: () => {
      const better = diffs.filter((d) => d.direction === 'better').length
      const worse = diffs.filter((d) => d.direction === 'worse').length
      return `${better} metric${better === 1 ? '' : 's'} got better, ${worse} got worse, the rest did not really change.`
    },
  }
}
