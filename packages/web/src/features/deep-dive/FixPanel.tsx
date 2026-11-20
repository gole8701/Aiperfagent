import type { Issue } from '@perfagent/core'
import { useState } from 'react'
import { Link } from 'react-router'

import { api, describeError } from '../../api/client'
import type { FixScope, ProposedChange, Status } from '../../api/types'
import { Button } from '../../components/Button'
import { ErrorBox } from '../../components/Card'
import { CodeDiff } from '../../components/CodeDiff'
import { Select } from '../../components/Fields'
import { useFix } from '../../state/fix'
import { filterToString, useReport } from '../../state/report'

import { FixRunView } from './FixRunView'

interface FixPanelProps {
  issue: Issue
  status?: Status
}

const SCOPES = [
  { value: 'issue', label: 'This problem' },
  { value: 'file', label: 'This file' },
  { value: 'chip', label: 'This chip' },
  { value: 'route', label: 'This route' },
  { value: 'site', label: 'Whole site' },
]

/** Section 5 of the deep dive: steps, before/after, built-in fix, fix or suggest with the user's AI, explain. */
export function FixPanel({ issue, status }: FixPanelProps) {
  const report = useReport((s) => s.report)
  const filter = useReport((s) => s.filter)
  const { start, busy, run } = useFix()
  const [scope, setScope] = useState('issue')
  const [suggestions, setSuggestions] = useState<ProposedChange[]>()
  const [explanation, setExplanation] = useState<string>()
  const [error, setError] = useState<{ message: string; hint?: string }>()
  const [working, setWorking] = useState<'suggest' | 'explain'>()

  const canApply = Boolean(status?.capabilities.applyFixes)
  const hasAi = Boolean(status?.capabilities.ai)
  const aiConfigured = status?.config.aiProvider && status.config.aiProvider !== 'none'

  function fixScope(): FixScope {
    switch (scope) {
      case 'file':
        return { kind: 'file', file: issue.location?.file ?? '' }
      case 'chip':
        return { kind: 'chip', chip: filterToString(filter) }
      case 'route':
        return { kind: 'route', route: issue.route ?? '/' }
      case 'site':
        return { kind: 'site' }
      default:
        return { kind: 'issue', issueIds: [issue.id] }
    }
  }

  async function call(kind: 'suggest' | 'explain'): Promise<void> {
    setWorking(kind)
    setError(undefined)
    try {
      if (kind === 'explain')
        setExplanation(
          (
            await api.post<{ text: string }>('/api/ai/explain', {
              reportId: report?.id,
              issueId: issue.id,
            })
          ).text,
        )
      else
        setSuggestions(
          (
            await api.post<{ changes: ProposedChange[] }>('/api/ai/suggest', {
              reportId: report?.id,
              issueIds: [issue.id],
            })
          ).changes,
        )
    } catch (err) {
      setError(describeError(err))
    } finally {
      setWorking(undefined)
    }
  }

  const aiUnavailable = !hasAi || !aiConfigured

  return (
    <div className="stack" style={{ gap: 10 }}>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {issue.fix.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {issue.fix.changes.map((change, index) => (
        <CodeDiff key={index} file={change.file} before={change.before} after={change.after} />
      ))}
      <div className="row">
        {issue.fix.automatic && canApply ? (
          <Button
            variant="primary"
            busy={busy}
            disabled={Boolean(run)}
            onClick={() =>
              void start(
                report?.id ?? '',
                { kind: 'issue', issueIds: [issue.id] },
                { review: true },
              )
            }
            title="Applies the rule's change on a new branch, with review"
          >
            Built-in fix · apply
          </Button>
        ) : (
          <span className="badge badge-good">
            {issue.fix.automatic
              ? 'Built-in fix (free, no AI): shown above'
              : 'Built-in fix: follow the steps above'}
          </span>
        )}
        {canApply ? (
          <>
            <Select
              label="Fix scope"
              hideLabel
              value={scope}
              options={SCOPES}
              onChange={setScope}
            />
            <Button
              variant="ai"
              busy={busy}
              disabled={Boolean(run) || aiUnavailable}
              onClick={() => void start(report?.id ?? '', fixScope(), { review: true })}
            >
              Fix with my AI
            </Button>
          </>
        ) : hasAi ? (
          <Button
            variant="ai"
            busy={working === 'suggest'}
            disabled={aiUnavailable}
            onClick={() => void call('suggest')}
          >
            Suggest with my AI
          </Button>
        ) : null}
        {hasAi ? (
          <Button
            busy={working === 'explain'}
            disabled={aiUnavailable}
            onClick={() => void call('explain')}
          >
            Explain with AI
          </Button>
        ) : null}
        {hasAi && !aiConfigured ? (
          <span className="muted" style={{ fontSize: 12 }}>
            No AI connected yet.{' '}
            <Link to="/settings/ai">Connect your AI (free options available)</Link>
          </span>
        ) : null}
      </div>
      {error ? <ErrorBox error={error} /> : null}
      {explanation ? (
        <div className="card" style={{ background: 'var(--panel-2)' }}>
          <div className="label">AI explanation</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{explanation}</p>
        </div>
      ) : null}
      {suggestions ? (
        <div className="stack">
          <div className="label">Suggested changes (nothing applied)</div>
          {suggestions.length === 0 ? (
            <span className="muted">The AI had no change to propose.</span>
          ) : null}
          {suggestions.map((s, index) => (
            <div key={index}>
              <p style={{ margin: '0 0 6px' }}>{s.explanation}</p>
              <CodeDiff file={s.file} before={s.before} after={s.after} />
            </div>
          ))}
        </div>
      ) : null}
      <FixRunView />
    </div>
  )
}
