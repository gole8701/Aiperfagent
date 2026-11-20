import type { HistoryPoint, PageResult, Report } from '@perfagent/core'
import type { EChartsOption } from 'echarts'

export interface Palette {
  text: string
  muted: string
  border: string
  panel: string
  good: string
  warning: string
  critical: string
  accent: string
  series: string[]
}

export interface ChartContext {
  report: Report
  /** The page selected in the page filter; the first page when "all pages". */
  page?: PageResult
  route?: string
  history: HistoryPoint[]
  expert: boolean
  palette: Palette
}

export type ChartClick = { issueId?: string; filter?: string }

interface BaseDefinition {
  id: string
  /** The title is always a question. */
  question: string
  /** One line on how to read the chart. */
  howToRead: string
  /** Guide topic for the "i" link. */
  guide: string
  /** One sentence generated from the data. */
  takeaway: (ctx: ChartContext) => string
  /** True when the real data is missing and sample numbers are shown; the text says what to connect. */
  sample?: (ctx: ChartContext) => string | undefined
  onClick?: (params: { name?: string; dataIndex?: number; seriesName?: string }, ctx: ChartContext) => ChartClick | undefined
}

export type ChartDefinition = BaseDefinition &
  (
    | { kind: 'echarts'; build: (ctx: ChartContext) => EChartsOption; height?: number }
    | { kind: 'summary'; build: (ctx: ChartContext) => { headline: string; sentences: string[] } }
    | { kind: 'filmstrip'; build: (ctx: ChartContext) => { frames: { timeMs: number; image: string }[] } }
    | { kind: 'tiles'; build: (ctx: ChartContext) => { label: string; value: string; note: string; rating?: 'good' | 'needs-work' | 'poor' }[] }
  )

export type ChartTab = 'overview' | 'speed' | 'code' | 'network' | 'live' | 'ai' | 'users' | 'business'

export const CHART_TABS: { id: ChartTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'speed', label: 'Speed' },
  { id: 'code', label: 'Code & files' },
  { id: 'network', label: 'Network' },
  { id: 'live', label: 'Live & server' },
  { id: 'ai', label: 'AI' },
  { id: 'users', label: 'Users & places' },
  { id: 'business', label: 'Business impact' },
]
