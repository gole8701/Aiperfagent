import { Card } from '../../components/Card'
import { Select, Toggle } from '../../components/Fields'
import { useSettings } from '../../state/settings'
import { THEME_LABELS, useDisplay, type Theme } from '../../state/theme'
import { IS_STATIC } from '../../static/env'

import { SchemaRows } from './SchemaRows'
import { SettingsShell } from './SettingsShell'

const SHOWN_ELSEWHERE = (path: string): boolean =>
  path.startsWith('ai.') ||
  path.startsWith('fix.') ||
  ['editor', 'theme', 'language', 'device', 'runs', 'root'].includes(path)

export default function DisplaySettings() {
  const { theme, setTheme, density, setDensity, presentation, setPresentation } = useDisplay()
  const save = useSettings((s) => s.save)
  return (
    <SettingsShell active="display" title="Display">
      <div className="settings-grid">
        <Card title="Theme and layout">
          <div className="stack" style={{ gap: 10 }}>
            <Select
              label="Theme"
              value={theme}
              options={(Object.keys(THEME_LABELS) as Theme[]).map((t) => ({
                value: t,
                label: THEME_LABELS[t],
              }))}
              onChange={(v) => {
                setTheme(v as Theme)
                if (!IS_STATIC) void save({ theme: v }).catch(() => undefined)
              }}
            />
            <Toggle
              label="High contrast"
              checked={theme === 'high-contrast'}
              onChange={(on) => setTheme(on ? 'high-contrast' : 'dark')}
            />
            <Select
              label="Density"
              value={density}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
              onChange={(v) => setDensity(v as 'comfortable' | 'compact')}
            />
            <Toggle
              label="Presentation mode"
              description="Big fonts for meetings"
              checked={presentation}
              onChange={setPresentation}
            />
          </div>
        </Card>
        {!IS_STATIC ? (
          <>
            <Card title="Project defaults">
              <SchemaRows
                include={(p) => ['language', 'editor', 'device', 'runs'].includes(p)}
                labels={{
                  language: 'Guide language',
                  editor: 'Default editor',
                  device: 'Device profile',
                  runs: 'Runs per page',
                }}
              />
            </Card>
            <Card title="Everything else">
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                Every other option from the config schema, so new options appear here automatically.
              </p>
              <SchemaRows include={(p) => !SHOWN_ELSEWHERE(p)} />
            </Card>
          </>
        ) : null}
      </div>
    </SettingsShell>
  )
}
