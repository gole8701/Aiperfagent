import type { EChartsOption } from 'echarts'

import type { ChartContext, Palette } from './types'

/** What ECharts hands to label/tooltip formatters; typed loosely so callbacks accept any series. */
export interface FormatterParams {
  value?: unknown
  dataIndex?: number
  name?: string
}

export function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

/** Axis and tooltip styling shared by every ECharts chart so they read as one system. */
export function baseOption(palette: Palette): EChartsOption {
  return {
    color: palette.series,
    textStyle: { color: palette.text, fontFamily: 'Inter, system-ui, sans-serif' },
    tooltip: { trigger: 'item', backgroundColor: palette.panel, borderColor: palette.border, textStyle: { color: palette.text } },
    grid: { left: 12, right: 16, top: 16, bottom: 8, containLabel: true },
  }
}

export function axisStyle(palette: Palette): { axisLine: object; axisLabel: object; splitLine: object; axisTick: object } {
  return {
    axisLine: { lineStyle: { color: palette.border } },
    axisTick: { show: false },
    axisLabel: { color: palette.muted },
    splitLine: { lineStyle: { color: palette.border } },
  }
}

export function horizontalBars(ctx: ChartContext, labels: string[], values: number[], options: { colors?: string[]; unit?: string; markValue?: number; markLabel?: string } = {}): EChartsOption {
  const p = ctx.palette
  return {
    ...baseOption(p),
    grid: { left: 12, right: 50, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted, formatter: (v: number) => `${v}${options.unit ?? ''}` } },
    yAxis: { type: 'category', data: labels, inverse: true, ...axisStyle(p), axisLabel: { color: p.text, width: 220, overflow: 'truncate' } },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({ value: round(v), itemStyle: { color: options.colors?.[i] ?? p.series[0] } })),
        label: { show: true, position: 'right', color: p.text, formatter: (d: FormatterParams) => `${num(d.value)}${options.unit ?? ''}` },
        barMaxWidth: 26,
        markLine: options.markValue !== undefined ? { symbol: 'none', data: [{ xAxis: options.markValue, label: { formatter: options.markLabel ?? '', color: p.muted }, lineStyle: { color: p.good, type: 'dashed' } }] } : undefined,
      },
    ],
  }
}

export function donut(ctx: ChartContext, data: { name: string; value: number }[], centreText?: string): EChartsOption {
  const p = ctx.palette
  return {
    ...baseOption(p),
    legend: { bottom: 0, textStyle: { color: p.text }, icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '45%'],
        data,
        label: { color: p.text, formatter: '{b}: {c}' },
        itemStyle: { borderColor: p.panel, borderWidth: 2 },
      },
    ],
    title: centreText ? { text: centreText, left: 'center', top: '38%', textStyle: { color: p.text, fontSize: 22, fontWeight: 600 } } : undefined,
  }
}

export function gauge(ctx: ChartContext, value: number, options: { max?: number; unit?: string; target?: number; label: string; invert?: boolean }): EChartsOption {
  const p = ctx.palette
  const max = options.max ?? 100
  const zones: [number, string][] = options.invert ? [[0.3, p.good], [0.7, p.warning], [1, p.critical]] : [[0.3, p.critical], [0.7, p.warning], [1, p.good]]
  return {
    ...baseOption(p),
    series: [
      {
        type: 'gauge',
        min: 0,
        max,
        startAngle: 200,
        endAngle: -20,
        progress: { show: true, width: 14, itemStyle: { color: p.accent } },
        axisLine: { lineStyle: { width: 14, color: zones } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: { valueAnimation: true, formatter: (v: number) => `${Math.round(v)}${options.unit ?? ''}`, color: p.text, fontSize: 28, offsetCenter: [0, '0%'] },
        title: { color: p.muted, offsetCenter: [0, '40%'], fontSize: 12 },
        data: [{ value, name: options.target !== undefined ? `${options.label} · target ${options.target}${options.unit ?? ''}` : options.label }],
      },
    ],
  }
}

export function round(value: number, digits = 0): number {
  const k = 10 ** digits
  return Math.round(value * k) / k
}

export function seconds(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function fileName(url: string): string {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? url
  } catch {
    return url
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'unknown'
  }
}

export function percent(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0
}
