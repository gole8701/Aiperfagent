import { aiCharts } from './ai'
import { business } from './business'
import { code } from './code'
import { liveCharts } from './live'
import { network } from './network'
import { overview } from './overview'
import { speed } from './speed'
import type { ChartDefinition, ChartTab } from './types'
import { users } from './users'

/** The catalogue of Part 16: 8 tabs, 35 charts. Adding a chart means adding a definition here, nothing else. */
export const CHARTS: Record<ChartTab, ChartDefinition[]> = {
  overview,
  speed,
  code,
  network,
  live: liveCharts,
  ai: aiCharts,
  users,
  business,
}

export { CHART_TABS } from './types'
export type { ChartContext, ChartDefinition, ChartTab, Palette } from './types'
