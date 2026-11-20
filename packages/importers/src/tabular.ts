import type { DetectedValue, MetricId } from '@perfagent/core'

import { metricForLabel, plausible, routeInText } from './metric-aliases.js'
import { parseHumanNumber } from './report-builder.js'

/** Shared "header row + value rows" reader used by CSV, Excel sheets and pasted tables. */
export interface RowsResult {
  detected: DetectedValue[]
  /** False when any column was matched by a fuzzy header name. */
  exact: boolean
  createdAt?: string
}

const ROUTE_HEADER = /\b(page|url|route|path|pathname|screen|address)\b/i
const LABEL_HEADER = /\b(label|name|title|version|build|run)\b/i
const DATE_HEADER = /\b(date|day|timestamp|when|created)\b/i
const HEADER_UNIT = /\((ms|s|kb|mb|%)\)/i

/** Splits a line on pipes, tabs, commas or runs of 2+ spaces. Returns undefined when it is not a row. */
export function splitCells(line: string): string[] | undefined {
  const trimmed = line.trim()
  if (!trimmed) return undefined
  const delimiter = trimmed.includes('|') ? '|' : trimmed.includes('\t') ? '\t' : trimmed.includes(',') ? ',' : /\s{2,}/.test(trimmed) ? /\s{2,}/ : undefined
  if (!delimiter) return undefined
  const cells = trimmed.split(delimiter).map((c) => c.trim())
  if (delimiter === '|') {
    if (cells[0] === '') cells.shift()
    if (cells[cells.length - 1] === '') cells.pop()
  }
  return cells.length >= 2 ? cells : undefined
}

interface Column { index: number; metric: MetricId; exact: boolean; unit: string }

export function detectedFromRows(rows: string[][], source: string): RowsResult {
  const header = rows[0] ?? []
  const columns: Column[] = []
  header.forEach((cell, index) => {
    const match = metricForLabel(cell)
    if (match) columns.push({ index, metric: match.metric, exact: match.exact, unit: HEADER_UNIT.exec(cell)?.[1] ?? '' })
  })
  const isMetricCol = (i: number): boolean => columns.some((c) => c.index === i)
  const findCol = (re: RegExp): number => header.findIndex((h, i) => !isMetricCol(i) && re.test(h))
  const routeCol = findCol(ROUTE_HEADER)
  const labelCol = findCol(LABEL_HEADER)
  const dateCol = findCol(DATE_HEADER)

  const detected: DetectedValue[] = []
  let createdAt: string | undefined
  rows.slice(1).forEach((row, i) => {
    const route = routeFor(row, routeCol, labelCol, rows.length > 2 ? `/row-${i + 1}` : undefined)
    const date = dateCol >= 0 ? Date.parse(row[dateCol] ?? '') : NaN
    if (!createdAt && !Number.isNaN(date)) createdAt = new Date(date).toISOString()
    for (const col of columns) {
      const raw = (row[col.index] ?? '').trim()
      if (!raw) continue
      const value = parseHumanNumber(/[a-z%]/i.test(raw) ? raw : `${raw} ${col.unit}`, col.metric)
      if (value === undefined || !plausible(col.metric, value)) continue
      detected.push({ metric: col.metric, value, route, confidence: col.exact ? 0.9 : 0.6, source })
    }
  })
  return { detected, exact: columns.every((c) => c.exact), createdAt }
}

function routeFor(row: string[], routeCol: number, labelCol: number, fallback: string | undefined): string | undefined {
  const cell = routeCol >= 0 ? row[routeCol] : labelCol >= 0 ? row[labelCol] : undefined
  if (cell?.trim()) return routeInText(cell) ?? cell.trim()
  return row.map((c) => routeInText(c)).find(Boolean) ?? fallback
}
