import {
  BarChart,
  CustomChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

/** Only the chart types and components the catalogue uses are bundled. */
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GaugeChart,
  TreemapChart,
  HeatmapChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export { echarts }
export type { EChartsOption } from 'echarts'
