import { Card } from '../../components/Card'

import { SchemaRows } from './SchemaRows'
import { SettingsShell } from './SettingsShell'

const LABELS: Record<string, string> = {
  'fix.review': 'Review each change',
  'fix.autoAccept': 'Auto-accept changes',
  'fix.runTests': 'Run tests after each change',
  'fix.testCommand': 'Test command',
  'fix.autoCommit': 'Auto-commit to fix branch',
  'fix.openPr': 'Open pull request when done',
  'fix.protected': 'Protected folders',
  'fix.maxRounds': 'Max rounds',
  'fix.maxFiles': 'Max files changed per run',
  'fix.maxCostUsd': 'Max AI cost per run ($)',
  'fix.target.score': 'Target score',
  'fix.target.lcp': 'Target LCP (ms)',
  'fix.target.inp': 'Target INP (ms)',
  'fix.target.cls': 'Target CLS',
}

export default function FixSettings() {
  return (
    <SettingsShell active="fix" title="Fix settings">
      <div className="settings-grid">
        <Card title="How fixes are applied">
          <SchemaRows include={(p) => p.startsWith('fix.') && !p.startsWith('fix.target') && !p.startsWith('fix.max')} labels={LABELS} />
        </Card>
        <Card title="Limits and targets">
          <SchemaRows include={(p) => p.startsWith('fix.max') || p.startsWith('fix.target')} labels={LABELS} />
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Always true: never on main directly, never pushes, merges or deploys by itself, never in deployed environments, and every change can be undone.
          </p>
        </Card>
      </div>
    </SettingsShell>
  )
}
