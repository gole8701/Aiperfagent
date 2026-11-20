import { METRICS, formatMetric, type Issue } from '@perfagent/core'

import { SeverityDot } from '../../components/Card'
import { Table, type Column } from '../../components/Table'

interface ProblemsTableProps {
  issues: Issue[]
  selectedId?: string
  onSelect: (issue: Issue) => void
  filterLabel: string
}

const STATUS_LABEL = { open: 'Open', fixed: 'Fixed', ignored: 'Ignored' }

export function gainLabel(issue: Issue): string {
  const g = issue.gain
  return `${METRICS[g.metric].short} ${formatMetric(g.metric, g.from)} → ~${formatMetric(g.metric, g.to)} · score +${g.scoreDelta}`
}

export function whereLabel(issue: Issue): string {
  if (issue.location)
    return `${issue.location.file}:${issue.location.line}${issue.location.symbol ? ` · ${issue.location.symbol}` : ''}`
  return issue.route ? `page ${issue.route}` : 'whole page'
}

const columns: Column<Issue>[] = [
  {
    key: 'severity',
    header: 'Severity',
    render: (i) => <SeverityDot severity={i.severity} />,
    width: '110px',
  },
  { key: 'title', header: 'Problem', render: (i) => <span>{i.plain}</span> },
  { key: 'where', header: 'Where', render: (i) => <span className="mono">{whereLabel(i)}</span> },
  {
    key: 'tags',
    header: 'Tags',
    render: (i) => (
      <span className="row">
        {[...i.metrics.map((m) => METRICS[m].short), ...i.areas].slice(0, 4).map((t) => (
          <span key={t} className="badge">
            {t}
          </span>
        ))}
      </span>
    ),
  },
  { key: 'gain', header: 'Estimated gain', render: (i) => <span>{gainLabel(i)}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (i) => (
      <span className={i.status === 'fixed' ? 'rating-good' : 'muted'}>
        {STATUS_LABEL[i.status]}
      </span>
    ),
    width: '80px',
  },
]

export function ProblemsTable({ issues, selectedId, onSelect, filterLabel }: ProblemsTableProps) {
  return (
    <section
      id="problems"
      className="card home-bottom"
      data-tour="bottom"
      aria-label="All problems"
    >
      <div className="card-title">
        <h3 className="label">
          All problems ({filterLabel}) · {issues.length} · click one to fly to it on the globe
        </h3>
      </div>
      <Table
        columns={columns}
        rows={issues}
        rowKey={(i) => i.id}
        onRowClick={onSelect}
        selectedKey={selectedId}
        caption="All performance problems sorted by estimated gain"
        empty="No problems match this filter."
      />
    </section>
  )
}
