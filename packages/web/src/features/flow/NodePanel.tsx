import { METRICS, type Issue, type TreeNode } from '@perfagent/core'
import { Link } from 'react-router'

import type { Status } from '../../api/types'
import { Button, LinkButton } from '../../components/Button'
import { Card, SeverityDot } from '../../components/Card'
import { useFix } from '../../state/fix'
import { EditorOpen } from '../deep-dive/EditorOpen'
import { FixRunView } from '../deep-dive/FixRunView'

import { issueIdsWithin } from './visible'

interface NodePanelProps {
  node?: TreeNode
  issues: Issue[]
  status?: Status
  reportId?: string
}

const KIND_LABEL: Record<TreeNode['kind'], string> = {
  root: 'Project',
  dir: 'Folder',
  file: 'File',
  component: 'Component',
  function: 'Function',
  element: 'Element',
}

export function NodePanel({ node, issues, status, reportId }: NodePanelProps) {
  const { start, busy, run } = useFix()
  if (!node) {
    return (
      <Card title="Details">
        <span className="muted">
          Click a node to see its problems, open it in your editor or fix it with your AI.
        </span>
      </Card>
    )
  }
  const ids = new Set(issueIdsWithin(node))
  const inside = issues.filter((i) => ids.has(i.id))
  const filePath = node.kind === 'file' ? node.path : node.path.split(':')[0]
  const canFix =
    status?.capabilities.applyFixes &&
    status.config.aiProvider !== 'none' &&
    (node.kind === 'file' ||
      node.kind === 'component' ||
      node.kind === 'function' ||
      node.kind === 'element')

  return (
    <Card title={KIND_LABEL[node.kind]} className="flow-panel" data-tour="panel">
      <h2>{node.name}</h2>
      <div className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {node.path}
        {node.line ? `:${node.line}` : ''}
        {node.sizeBytes ? ` · ${(node.sizeBytes / 1024).toFixed(1)} KB` : ''}
      </div>
      {node.kind !== 'root' && node.kind !== 'dir' ? (
        <EditorOpen
          location={{ file: filePath ?? node.path, line: node.line ?? 1 }}
          status={status}
          label={`Open in editor · line ${node.line ?? 1}`}
        />
      ) : null}
      {!status?.capabilities.openEditor ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Opening and fixing files works in local mode only.
        </div>
      ) : null}

      <div className="label" style={{ margin: '14px 0 6px' }}>
        Problems here and inside ({inside.length})
      </div>
      {inside.length === 0 ? (
        <span className="muted">No performance problems found here.</span>
      ) : null}
      <div className="stack">
        {inside.map((issue) => (
          <div key={issue.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <SeverityDot severity={issue.severity} />
              <span className="badge">{issue.metrics.map((m) => METRICS[m].short).join(', ')}</span>
            </div>
            <strong>{issue.plain}</strong>
            {issue.location ? (
              <div className="mono muted" style={{ fontSize: 12 }}>
                {issue.location.file}:{issue.location.line}
              </div>
            ) : null}
            <div style={{ fontSize: 13 }}>Fix: {issue.fix.steps[0]}</div>
            <div className="row" style={{ marginTop: 6 }}>
              <LinkButton small to={`/issues/${encodeURIComponent(issue.id)}`}>
                Deep dive on globe
              </LinkButton>
            </div>
          </div>
        ))}
      </div>

      {canFix && filePath ? (
        <div style={{ marginTop: 14 }}>
          <Button
            variant="ai"
            busy={busy}
            disabled={Boolean(run)}
            onClick={() =>
              void start(reportId ?? '', { kind: 'file', file: filePath }, { review: true })
            }
          >
            Fix everything here with my AI
          </Button>
        </div>
      ) : null}
      {status?.capabilities.applyFixes && status.config.aiProvider === 'none' ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          <Link to="/settings/ai">Connect an AI</Link> to fix files automatically.
        </div>
      ) : null}
      <FixRunView />
    </Card>
  )
}
