import { useEffect, type ReactNode } from 'react'

import { Empty, ErrorBox, Spinner } from '../../components/Card'
import { Tabs } from '../../components/Tabs'
import { useSettings } from '../../state/settings'
import { IS_STATIC } from '../../static/env'
import './settings.css'

const TABS = [
  { id: 'ai', label: 'AI connections', to: '/settings/ai' },
  { id: 'fix', label: 'Fix settings', to: '/settings/fix' },
  { id: 'display', label: 'Display', to: '/settings/display' },
]

/** Shared frame for the three settings screens: tabs, loading and error states, settings fetched once. */
export function SettingsShell({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  const { config, loading, error, load } = useSettings()
  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page settings">
      <h1 style={{ marginBottom: 12 }}>Settings</h1>
      <Tabs label="Settings sections" active={active} items={TABS} />
      <h2 style={{ marginBottom: 12 }}>{title}</h2>
      {IS_STATIC && active !== 'display' ? (
        <Empty>Settings are stored by the installed tool. On the website only display options are available.</Empty>
      ) : error ? (
        <ErrorBox error={error} />
      ) : loading || (!config && !IS_STATIC) ? (
        <Spinner label="Loading settings" />
      ) : (
        children
      )}
    </div>
  )
}
