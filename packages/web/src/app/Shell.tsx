import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import { onWsMessage } from '../api/ws'
import { Select } from '../components/Fields'
import { useReport } from '../state/report'
import { THEME_LABELS, useDisplay, type Theme } from '../state/theme'
import { IS_STATIC } from '../static/env'

import { ExportMenu } from './ExportMenu'
import { ScanBox } from './ScanBox'
import './shell.css'

const NAV = [
  { to: '/', label: 'Globe', end: true },
  { to: '/flow', label: 'Flow diagram' },
  { to: '/charts/overview', label: 'Charts' },
  { to: '/compare', label: 'Compare' },
  { to: '/live', label: 'Live' },
  { to: '/guide', label: 'Guide' },
  { to: '/settings/ai', label: 'Settings' },
]

/** Which guide topic the header "?" button opens on each screen. */
const GUIDE_BY_ROUTE: [RegExp, string][] = [
  [/^\/issues/, 'deep-dive'],
  [/^\/flow/, 'flow-diagram'],
  [/^\/charts/, 'charts'],
  [/^\/compare/, 'compare'],
  [/^\/live/, 'live'],
  [/^\/settings\/ai/, 'connect-ai'],
  [/^\/settings\/fix/, 'fix-with-ai'],
  [/^\/settings/, 'themes'],
  [/^\/guide/, ''],
  [/^\//, 'globe'],
]

export function Shell({ children }: { children: ReactNode }) {
  const status = useReport((s) => s.status)
  const { theme, setTheme } = useDisplay()
  const location = useLocation()
  const header = useRef<HTMLElement>(null)
  useServerEvents()
  useTopbarHeight(header)

  const topic = GUIDE_BY_ROUTE.find(([pattern]) => pattern.test(location.pathname))?.[1] ?? 'globe'
  const framework = status?.project.framework
    ? `${status.project.framework}${status.project.frameworkVersion ? ` ${status.project.frameworkVersion}` : ''}`
    : undefined

  return (
    <>
      <header ref={header} className="topbar no-print" data-tour="header">
        <Link to="/" className="brand" aria-label="PerfAgent home">
          <span className="brand-mark" aria-hidden="true" />
          PerfAgent
        </Link>
        {status ? (
          <span className="badge" title={status.project.root || undefined}>
            {status.project.name ?? 'project'} · {status.mode} mode
          </span>
        ) : null}
        {framework ? <span className="badge">Detected: {framework}</span> : null}
        <nav className="nav-menu" aria-label="Screens">
          {NAV.filter((n) => !IS_STATIC || !['/live', '/settings/ai'].includes(n.to)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <ScanBox />
        <Select
          label="Theme"
          hideLabel
          value={theme}
          options={(Object.keys(THEME_LABELS) as Theme[]).map((t) => ({
            value: t,
            label: THEME_LABELS[t],
          }))}
          onChange={(value) => setTheme(value as Theme)}
        />
        <ExportMenu />
        {topic ? (
          <Link
            to={`/guide/${topic}`}
            className="help-button"
            aria-label="Help for this screen"
            title="Help for this screen"
          >
            ?
          </Link>
        ) : null}
      </header>
      {status && status.mode !== 'local' && status.mode !== 'static' ? (
        <div className="banner no-print" role="status">
          Deployed environment: suggestions only. Import this report locally to apply fixes.
        </div>
      ) : null}
      {IS_STATIC ? (
        <div className="banner no-print" role="status">
          Website demo: sample data from a real scan. Run <code>npx perfagent</code> in your project
          to scan, open files and fix.
        </div>
      ) : null}
      <main id="main">{children}</main>
    </>
  )
}

/** Publishes the header height as --topbar-h so sticky panels sit right under it. */
function useTopbarHeight(header: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = header.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [header])
}

/** One WebSocket for the whole app: scan progress updates the store, finished scans reload the report. */
function useServerEvents(): void {
  const setScan = useReport((s) => s.setScan)
  const loadReport = useReport((s) => s.loadReport)
  useEffect(
    () =>
      onWsMessage((message) => {
        if (message.type === 'scan:progress')
          setScan({
            jobId: message.jobId,
            phase: message.phase,
            message: message.message,
            fraction: message.fraction,
          })
        if (message.type === 'scan:done') {
          setScan(undefined)
          void loadReport(message.reportId)
        }
        if (message.type === 'scan:error')
          setScan({
            jobId: message.jobId,
            phase: 'error',
            message: message.message,
            fraction: 1,
            error: message.message,
          })
      }),
    [setScan, loadReport],
  )
}
