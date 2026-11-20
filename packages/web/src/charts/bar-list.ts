import type { EChartsOption } from './echarts'

const BAR_ROW_PX = 34

/** Horizontal bar lists get a height that fits their bars and labels cut to one line. */
export function barList(option: EChartsOption): { option: EChartsOption; height?: number } {
  const axis = option.yAxis
  const series = Array.isArray(option.series) ? option.series : [option.series]
  if (
    !axis ||
    Array.isArray(axis) ||
    axis.type !== 'category' ||
    !Array.isArray(axis.data) ||
    !series.some((s) => s?.type === 'bar')
  )
    return { option }
  return {
    height: Math.max(120, axis.data.length * BAR_ROW_PX + 40),
    option: {
      ...option,
      yAxis: {
        ...axis,
        triggerEvent: true,
        axisLabel: { width: 220, overflow: 'truncate', ...axis.axisLabel },
      },
    },
  }
}
