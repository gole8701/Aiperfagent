import { useState } from 'react'

import { Button } from '../../components/Button'
import { Card, ErrorBox } from '../../components/Card'
import { CodeDiff } from '../../components/CodeDiff'
import { describeEvent, useFix } from '../../state/fix'

/** Live view of an AI fix run: event log, pending changes to Accept / Edit / Skip, Undo. */
export function FixRunView() {
  const { run, busy, error, accept, skip, undo, clear } = useFix()
  const [edits, setEdits] = useState<Record<string, string>>({})
  if (!run) return null

  return (
    <Card title={`AI fix run · branch ${run.branch} · ${run.status}`} action={<Button small onClick={clear}>Close</Button>}>
      {error ? <ErrorBox error={error} /> : null}
      <ol className="stack" style={{ gap: 4, paddingLeft: 18, fontSize: 13, margin: '0 0 10px' }} aria-live="polite" aria-label="Fix run events">
        {run.events.map((event, index) => (
          <li key={index} className={event.type === 'error' || (event.type === 'check' && !event.ok) ? 'sev-critical' : undefined}>
            {describeEvent(event)}
            {event.type === 'check' && !event.ok && event.output ? <pre style={{ marginTop: 4, maxHeight: 160 }}>{event.output}</pre> : null}
          </li>
        ))}
        {run.status === 'running' ? <li className="muted">Working…</li> : null}
      </ol>
      {run.pending.map((pending) => {
        const edited = edits[pending.changeId] ?? pending.change.after
        return (
          <div key={pending.changeId} className="stack" style={{ gap: 8, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13 }}>{pending.change.explanation}</div>
            <CodeDiff file={pending.change.file} before={pending.change.before} after={edited} />
            <label className="field">
              <span>Edit the proposed code before accepting</span>
              <textarea className="input mono" value={edited} onChange={(event) => setEdits({ ...edits, [pending.changeId]: event.target.value })} />
            </label>
            <div className="row">
              <Button variant="primary" busy={busy} onClick={() => void accept([pending.changeId], edits[pending.changeId] ? { [pending.changeId]: edited } : undefined)}>
                Accept
              </Button>
              <Button busy={busy} onClick={() => void skip([pending.changeId])}>
                Skip
              </Button>
            </div>
          </div>
        )
      })}
      {run.status === 'done' || run.status === 'failed' ? (
        <div className="row" style={{ marginTop: 10 }}>
          <Button variant="danger" busy={busy} onClick={() => void undo()}>
            Undo all changes
          </Button>
        </div>
      ) : null}
      {run.status === 'undone' ? <div className="muted">All changes were undone.</div> : null}
    </Card>
  )
}
