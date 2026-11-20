export type SceneId =
  | 'globe'
  | 'flow'
  | 'charts'
  | 'compare'
  | 'terminal'
  | 'settings'
  | 'editor'
  | 'assistant'

interface Area {
  l: number
  t: number
  w: number
  h: number
  label: string
  round?: boolean
}

export interface Scene {
  name: string
  /** Route whose real screen can play the same steps as a driver.js tour. */
  route?: RegExp
  areas: Record<string, Area>
}

/** Simplified drawings of the real screens, in percent of the stage, with named areas the pointer can highlight. */
export const SCENES: Record<SceneId, Scene> = {
  globe: {
    name: 'Globe (home)',
    route: /^\/($|issues)/,
    areas: {
      header: { l: 0, t: 0, w: 100, h: 12, label: 'Top bar: Scan, URL, theme, export' },
      left: { l: 1.5, t: 16, w: 20, h: 64, label: 'Left panel: score, vitals, chips' },
      chips: { l: 1.5, t: 52, w: 20, h: 28, label: 'Filter chips' },
      globe: { l: 39, t: 17, w: 22, h: 60, label: 'Globe', round: true },
      right: { l: 77, t: 16, w: 21.5, h: 64, label: 'Deep dive' },
      bottom: { l: 1.5, t: 84, w: 97, h: 13, label: 'All problems list' },
      scan: { l: 70, t: 2, w: 8, h: 8, label: 'Scan button' },
    },
  },
  flow: {
    name: 'Flow diagram',
    route: /^\/flow/,
    areas: {
      header: { l: 0, t: 0, w: 100, h: 12, label: 'Toolbar: search, expand, problems only' },
      crumbs: { l: 1.5, t: 15, w: 97, h: 8, label: 'Path breadcrumb' },
      tree: { l: 1.5, t: 26, w: 66, h: 70, label: 'Folders → files → components (left to right)' },
      panel: { l: 70, t: 26, w: 28.5, h: 70, label: 'Details: problems + Open in editor' },
    },
  },
  charts: {
    name: 'Charts view',
    route: /^\/charts/,
    areas: {
      header: { l: 0, t: 0, w: 100, h: 12, label: 'Page filter, expert mode, export' },
      summary: { l: 1.5, t: 15, w: 97, h: 14, label: 'In simple words' },
      bars: { l: 1.5, t: 32, w: 97, h: 26, label: 'What slows your page the most' },
      donut: { l: 1.5, t: 61, w: 47, h: 35, label: 'What kind of problems' },
      bullets: { l: 51.5, t: 61, w: 47, h: 35, label: 'Speed vs target' },
    },
  },
  compare: {
    name: 'Compare',
    route: /^\/compare/,
    areas: {
      header: { l: 0, t: 0, w: 100, h: 12, label: 'Comparison type tabs' },
      sources: { l: 1.5, t: 15, w: 97, h: 22, label: 'Sources A and B' },
      run: { l: 1.5, t: 40, w: 14, h: 8, label: 'Compare button' },
      verdict: { l: 1.5, t: 51, w: 97, h: 18, label: 'Verdict in simple words' },
      impact: { l: 1.5, t: 72, w: 97, h: 25, label: 'Where is the impact' },
    },
  },
  terminal: {
    name: 'Terminal',
    areas: { term: { l: 3, t: 8, w: 94, h: 84, label: '$ _' } },
  },
  settings: {
    name: 'Settings · AI connections',
    route: /^\/settings/,
    areas: {
      header: { l: 0, t: 0, w: 100, h: 12, label: 'Settings tabs' },
      providers: { l: 1.5, t: 15, w: 47, h: 38, label: 'Your AI providers (API key)' },
      mcp: { l: 51.5, t: 15, w: 47, h: 38, label: 'AI assistants (MCP)' },
      defaults: { l: 1.5, t: 57, w: 47, h: 38, label: 'Free default AI' },
      limits: { l: 51.5, t: 57, w: 47, h: 38, label: 'Limits & privacy' },
    },
  },
  editor: {
    name: 'Your code editor',
    areas: {
      files: { l: 1.5, t: 4, w: 20, h: 92, label: 'Files' },
      code: { l: 23.5, t: 4, w: 75, h: 92, label: 'Code: problem line highlighted' },
    },
  },
  assistant: {
    name: 'Your AI assistant',
    areas: {
      chat: { l: 1.5, t: 6, w: 55, h: 88, label: 'Chat' },
      tools: { l: 58.5, t: 6, w: 40, h: 40, label: 'PerfAgent tools called' },
      diff: { l: 58.5, t: 50, w: 40, h: 44, label: 'Code changes to review' },
    },
  },
}

/** Real-screen tour targets: the `data-tour` attribute each scene area maps to. */
export function tourSelector(screen: SceneId, area: string): string | undefined {
  const known: Record<SceneId, string[]> = {
    globe: ['header', 'left', 'chips', 'globe', 'right', 'bottom', 'scan', 'charts-link'],
    flow: ['header', 'crumbs', 'tree', 'panel'],
    charts: ['header'],
    compare: ['sources', 'run'],
    settings: ['providers', 'mcp', 'defaults', 'limits'],
    terminal: [],
    editor: [],
    assistant: [],
  }
  return known[screen].includes(area) ? `[data-tour="${area}"]` : undefined
}

export function SceneView({ screen, highlight }: { screen: SceneId; highlight?: string }) {
  const scene = SCENES[screen]
  return (
    <div
      className={`scene scene-${screen}`}
      role="img"
      aria-label={`${scene.name}, ${highlight ? `highlighting ${scene.areas[highlight]?.label ?? highlight}` : 'overview'}`}
    >
      {Object.entries(scene.areas).map(([id, area]) => (
        <div
          key={id}
          className={`scene-area ${highlight === id ? 'active' : ''}`}
          style={{
            left: `${area.l}%`,
            top: `${area.t}%`,
            width: `${area.w}%`,
            height: `${area.h}%`,
            borderRadius: area.round ? '50%' : 6,
          }}
        >
          <span>{area.label}</span>
        </div>
      ))}
      {screen === 'globe' ? (
        <div className="scene-dot" style={{ left: '52%', top: '38%' }} />
      ) : null}
    </div>
  )
}
