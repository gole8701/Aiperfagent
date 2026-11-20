import { METRICS, formatMetric, type Issue } from '@perfagent/core'
import { useEffect, useRef, useState } from 'react'

import { api, describeError } from '../../api/client'
import type { Job } from '../../api/types'
import { Button } from '../../components/Button'
import { useReport } from '../../state/report'

/** Section 6: re-test one page and show predicted vs actual. Polls the job because re-tests do not stream progress. */
export function Verify({ issue, enabled }: { issue: Issue; enabled: boolean }) {
  const report = useReport((s) => s.report)
  const patchIssue = useReport((s) => s.patchIssue)
  const [job, setJob] = useState<Job>()
  const [error, setError] = useState<string>()
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function poll(id: string): Promise<void> {
    try {
      const next = await api.get<Job & { result?: Issue }>(`/api/jobs/${id}`)
      setJob(next)
      if (next.status === 'done' || next.status === 'failed') {
        if (next.status === 'failed') setError(next.error ?? 'Re-test failed')
        const fresh = await api.get<Issue>(`/api/issues/${encodeURIComponent(issue.id)}?reportId=${report?.id}`).catch(() => undefined)
        if (fresh?.verified) patchIssue(issue.id, { verified: fresh.verified })
        return
      }
      timer.current = window.setTimeout(() => void poll(id), 2000)
    } catch (err) {
      setError(describeError(err).message)
    }
  }

  async function retest(): Promise<void> {
    setError(undefined)
    try {
      const { jobId } = await api.post<{ jobId: string }>(`/api/scans/${report?.id}/retest`, { issueId: issue.id })
      setJob({ id: jobId, kind: 'retest', status: 'queued', progress: { phase: 'queued', message: 'Starting', fraction: 0 } })
      void poll(jobId)
    } catch (err) {
      setError(describeError(err).message)
    }
  }

  const running = job && (job.status === 'queued' || job.status === 'running')
  const v = issue.verified
  return (
    <div className="stack" style={{ gap: 6 }}>
      {v ? (
        <div role="status">
          Predicted <strong>{formatMetric(v.metric, v.predicted)}</strong> · actual <strong className={v.actual <= v.predicted ? 'rating-good' : 'rating-needs-work'}>{formatMetric(v.metric, v.actual)}</strong> ({METRICS[v.metric].short}, {new Date(v.at).toLocaleString()})
        </div>
      ) : (
        <span className="muted">Re-runs only this page (median of your configured runs) and compares the result with the estimate.</span>
      )}
      {enabled ? (
        <div className="row">
          <Button onClick={() => void retest()} busy={Boolean(running)}>
            Re-test to verify
          </Button>
          {running ? <span className="muted" aria-live="polite">{job.progress.message}</span> : null}
        </div>
      ) : null}
      {error ? (
        <span role="alert" className="sev-critical">
          {error}
        </span>
      ) : null}
    </div>
  )
}
