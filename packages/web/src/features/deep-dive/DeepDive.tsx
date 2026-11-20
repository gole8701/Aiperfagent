import { METRICS, formatMetric, type Budget, type Issue } from '@perfagent/core'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { Status } from '../../api/types'
import { Button, CopyButton } from '../../components/Button'
import { Card, SeverityDot } from '../../components/Card'
import { useReport } from '../../state/report'
import { useSettings } from '../../state/settings'
import type { GlobePoint } from '../globe/layout'
import { EditorOpen } from './EditorOpen'
import { FixPanel } from './FixPanel'
import { issueToMarkdown } from './issue-markdown'
import { Snippet } from './Snippet'
import { Verify } from './Verify'

interface DeepDiveProps {
  issue?: Issue
  point?: GlobePoint
  status?: Status
  onClose: () => void
}

const CHAIN_LABEL: Record<Issue['chain'][number]['kind'], string> = { metric: 'Metric', element: 'Element', request: 'Request', component: 'Component', code: 'Code', trace: 'Trace', cost: 'Cost', server: 'Server', dependency: 'Dependency' }

export function DeepDive({ issue, point, status, onClose }: DeepDiveProps) {
  const setIssueStatus = useReport((s) => s.setIssueStatus)
  if (!issue) {
    return (
      <Card title="Deep dive">
        {point ? (
          <div className="stack" style={{ gap: 6 }}>
            <strong>{point.label}</strong>
            <span className="mono muted">{point.path}</span>
            <span className="muted">No performance problems found {point.kind === 'folder' ? 'in this folder' : 'in this file'} in the last scan.</span>
            {point.kind === 'file' && status?.capabilities.openEditor ? <EditorOpen location={{ file: point.path, line: 1 }} status={status} label="Open in editor" /> : null}
          </div>
        ) : (
          <span className="muted">Click a glowing point on the globe, or a row in the problems list, to see where it comes from and how to fix it.</span>
        )}
      </Card>
    )
  }

  const local = Boolean(status?.capabilities.openEditor)
  const codeStep = issue.chain.find((s) => s.kind === 'code')

  return (
    <Card
      title={
        <div className="row" style={{ gap: 8 }}>
          <SeverityDot severity={issue.severity} />
          {issue.confidence < 0.6 ? <span className="badge">probable</span> : null}
        </div>
      }
      action={
        <Button small onClick={onClose} aria-label="Close deep dive">
          ✕
        </Button>
      }
    >
      <h2 style={{ marginBottom: 2 }}>{issue.plain}</h2>
      <div className="muted" style={{ marginBottom: 10 }}>
        {issue.title} · {issue.metrics.map((m) => METRICS[m].short).join(', ')}
      </div>

      <Section n={1} title="Where">
        {issue.location ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="mono">
              {issue.location.file}:{issue.location.line}
              {issue.location.symbol ? ` · ${issue.location.symbol}` : ''}
            </span>
            {issue.location.bundled ? <span className="muted" style={{ fontSize: 12 }}>mapped from {issue.location.bundled.file}:{issue.location.bundled.line} through source maps</span> : null}
            <EditorOpen location={issue.location} status={status} />
            <Link to={`/flow/${issue.location.file}`}>Show this file in the flow diagram</Link>
          </div>
        ) : (
          <span className="muted">Whole page{issue.route ? ` ${issue.route}` : ''}: no single line owns this one.</span>
        )}
      </Section>

      <Section n={2} title="Evidence · root cause chain">
        <ol className="stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>
          {issue.chain.map((step, index) => (
            <li key={index}>
              <span className="badge" style={{ marginRight: 6 }}>{CHAIN_LABEL[step.kind]}</span>
              <strong>{step.label}</strong>
              {step.detail && step.kind !== 'code' ? <div className="muted" style={{ fontSize: 13 }}>{step.detail}</div> : null}
            </li>
          ))}
        </ol>
        {issue.location ? (
          <div style={{ marginTop: 8 }}>
            <Snippet location={issue.location} fallback={codeStep?.detail} canReadFiles={local} />
          </div>
        ) : null}
      </Section>

      <Section n={3} title="Why it happens">
        <p style={{ margin: 0 }}>{issue.why}</p>
        {issue.frameworkRule ? <span className="badge" style={{ marginTop: 6 }}>Rule: {issue.frameworkRule}</span> : <span className="badge" style={{ marginTop: 6 }}>Rule: {issue.ruleId}</span>}
      </Section>

      <Section n={4} title="If you apply this fix (estimate)">
        <strong>
          {METRICS[issue.gain.metric].short} {formatMetric(issue.gain.metric, issue.gain.from)} → ~{formatMetric(issue.gain.metric, issue.gain.to)} · score +{issue.gain.scoreDelta}
        </strong>
        {issue.gain.note ? <div className="muted" style={{ fontSize: 12 }}>{issue.gain.note}</div> : null}
      </Section>

      <Section n={5} title="How to fix, step by step">
        <FixPanel issue={issue} status={status} />
      </Section>

      <Section n={6} title="Verify">
        <Verify issue={issue} enabled={Boolean(status?.capabilities.scanProject || status?.mode === 'deployed')} />
      </Section>

      <Section n={7} title="Stop it coming back">
        <Prevent budget={issue.prevent} canWrite={Boolean(status) && status?.mode !== 'static'} />
      </Section>

      <Section n={8} title="Official docs">
        {issue.docs.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {issue.docs.map((d) => (
              <li key={d.url}>
                <a href={d.url} target="_blank" rel="noreferrer">
                  {d.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted">No docs linked for this rule.</span>
        )}
      </Section>

      <div className="row" style={{ marginTop: 12 }}>
        <Button variant={issue.status === 'fixed' ? 'default' : 'primary'} onClick={() => void setIssueStatus(issue.id, issue.status === 'fixed' ? 'open' : 'fixed')}>
          {issue.status === 'fixed' ? 'Reopen' : 'Mark as fixed'}
        </Button>
        <Button onClick={() => void setIssueStatus(issue.id, issue.status === 'ignored' ? 'open' : 'ignored')}>{issue.status === 'ignored' ? 'Stop ignoring' : 'Ignore'}</Button>
        <CopyButton text={issueToMarkdown(issue)} label="Copy as Markdown" />
      </div>
    </Card>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }} aria-label={title}>
      <div className="label" style={{ marginBottom: 6 }}>
        {n}. {title}
      </div>
      {children}
    </section>
  )
}

const BUDGET_KEYS: Partial<Record<Budget['metric'], string>> = { lcp: 'lcp', inp: 'inp', cls: 'cls', ttfb: 'ttfb', tbt: 'tbt', score: 'score', jsKb: 'js', aiFirstTokenMs: 'aiFirstTokenMs', aiCacheHitRate: 'aiCacheHitRate' }

function Prevent({ budget, canWrite }: { budget?: Budget; canWrite: boolean }) {
  const save = useSettings((s) => s.save)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  if (!budget) return <span className="muted">No budget suggested for this rule.</span>
  const key = BUDGET_KEYS[budget.metric]
  const value = budget.metric === 'jsKb' ? `${Math.round(budget.max)}kb` : budget.max
  const text = `Budget: ${METRICS[budget.metric].short} at most ${formatMetric(budget.metric, budget.max)} on ${budget.route} (fails \`perfagent ci\`).`
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span>{text}</span>
      {canWrite && key ? (
        <div className="row">
          <Button
            small
            busy={state === 'saving'}
            onClick={() => {
              setState('saving')
              save({ budgets: { [budget.route]: { [key]: value } } })
                .then(() => setState('saved'))
                .catch(() => setState('error'))
            }}
          >
            Add to config
          </Button>
          {state === 'saved' ? <span className="rating-good">Saved to .perfagent/settings.json</span> : null}
          {state === 'error' ? <span className="sev-critical">Could not save the budget</span> : null}
        </div>
      ) : null}
    </div>
  )
}
