import {
  AREAS,
  CHIP_METRICS,
  CORE_WEB_VITALS,
  METRICS,
  formatMetric,
  metricValue,
  projectedScore,
  rateMetric,
  type ChipFilter,
  type Report,
} from '@perfagent/core'

import { Card } from '../../components/Card'
import { Chip } from '../../components/Chip'
import { InfoLink } from '../../components/Fields'
import { chipCounts } from '../../state/report'

interface LeftColumnProps {
  report: Report
  filter: ChipFilter
  onFilter: (filter: ChipFilter) => void
}

const RATING_LABEL = { good: 'Good', 'needs-work': 'Needs work', poor: 'Poor', none: '' }

export function LeftColumn({ report, filter, onFilter }: LeftColumnProps) {
  const page = report.pages[0]
  const metrics = page?.metrics ?? []
  const score = metricValue(metrics, 'score') ?? 0
  const open = report.issues.filter((i) => i.status === 'open')
  const projected = projectedScore(score, open)
  const counts = chipCounts(report)
  const bySeverity = {
    critical: open.filter((i) => i.severity === 'critical').length,
    warning: open.filter((i) => i.severity === 'warning').length,
    info: open.filter((i) => i.severity === 'info').length,
  }
  const isActive = (f: ChipFilter): boolean =>
    f.kind === 'all' ? filter.kind === 'all' : filter.kind === f.kind && filter.id === f.id

  return (
    <aside className="stack" data-tour="left" aria-label="Score, Web Vitals and filters">
      <Card>
        <div className="score-ring">
          <ScoreRing score={score} projected={projected} />
          <div>
            <div className="label">Performance score</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Estimated <strong style={{ color: 'var(--accent-soft)' }}>{projected}</strong> after
              all {open.length} fixes
            </div>
          </div>
        </div>
      </Card>

      <Card title={`Core Web Vitals · ${page?.device ?? 'mobile'}`}>
        {CORE_WEB_VITALS.map((id) => {
          const value = metricValue(metrics, id)
          if (value === undefined) return null
          const rating = rateMetric(id, value)
          return (
            <div className="vital-row" key={id}>
              <span className="row" style={{ gap: 6 }}>
                {METRICS[id].short}
                <InfoLink topic={METRICS[id].guide} what={METRICS[id].name} />
              </span>
              <span className="row" style={{ gap: 8 }}>
                <strong>{formatMetric(id, value)}</strong>
                <span
                  className={`badge badge-${rating === 'good' ? 'good' : rating === 'poor' ? 'critical' : 'warning'}`}
                >
                  {RATING_LABEL[rating]}
                </span>
              </span>
            </div>
          )
        })}
      </Card>

      <Card title="Problems found">
        {(['critical', 'warning', 'info'] as const).map((severity) => (
          <div className="vital-row" key={severity}>
            <span className="row" style={{ gap: 8 }}>
              <span className={`dot dot-${severity}`} aria-hidden="true" />
              {severity === 'info' ? 'Info' : severity.charAt(0).toUpperCase() + severity.slice(1)}
            </span>
            <strong>{bySeverity[severity]}</strong>
          </div>
        ))}
      </Card>

      <Card title="Show on globe · by metric" data-tour="chips">
        <div className="chips" role="group" aria-label="Filter by metric">
          <Chip
            label="All"
            count={counts.total}
            active={isActive({ kind: 'all' })}
            onClick={() => onFilter({ kind: 'all' })}
          />
          {CHIP_METRICS.map((id) => (
            <Chip
              key={id}
              label={METRICS[id].short}
              count={counts.metrics[id] ?? 0}
              active={isActive({ kind: 'metric', id })}
              onClick={() => onFilter({ kind: 'metric', id })}
              title={METRICS[id].plain}
            />
          ))}
        </div>
        <div className="label" style={{ margin: '12px 0 8px' }}>
          By area
        </div>
        <div className="chips" role="group" aria-label="Filter by area">
          {AREAS.map((area) => (
            <Chip
              key={area.id}
              label={area.label}
              count={counts.areas[area.id] ?? 0}
              active={isActive({ kind: 'area', id: area.id })}
              onClick={() => onFilter({ kind: 'area', id: area.id })}
              title={area.plain}
            />
          ))}
        </div>
      </Card>
    </aside>
  )
}

function ScoreRing({ score, projected }: { score: number; projected: number }) {
  const circumference = 2 * Math.PI * 50
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Performance score ${score}, estimated ${projected} after all fixes`}
      style={{ width: 92, height: 92, flex: '0 0 auto' }}
    >
      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.35"
        strokeWidth="10"
        strokeDasharray={`${(projected / 100) * circumference} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      <text
        x="60"
        y="70"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="30"
        fontWeight="600"
        fill="var(--text)"
      >
        {score}
      </text>
    </svg>
  )
}
