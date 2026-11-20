import type { DetectedValue, MetricId } from '@perfagent/core'

import { ALIAS_PATTERNS, metricForLabel, plausible, routeInText } from './metric-aliases.js'
import { parseHumanNumber } from './report-builder.js'
import { detectedFromRows, splitCells } from './tabular.js'

/**
 * Finds metric names and values in human-written text: pasted reports, PDF
 * pages, Word paragraphs, spreadsheet cells. Deterministic, no AI.
 */
const NUMBER = /\$?\s*(-?\d[\d,]*(?:\.\d+)?)\s*(ms|s|sec|seconds|kb|mb|%|\/\s*100|points|pts)?/i

interface Mention {
  id: MetricId
  start: number
  end: number
}

function mentionsIn(line: string): Mention[] {
  const lower = line.toLowerCase()
  const found: Mention[] = []
  for (const { id, re } of ALIAS_PATTERNS) {
    for (const m of lower.matchAll(re)) {
      const start = m.index
      const end = start + m[0].length
      if (!found.some((f) => start < f.end && end > f.start)) found.push({ id, start, end })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

const DATE_OR_TIME =
  /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?|\b\d{1,2}:\d{2}(?::\d{2})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g

/** A value within 40 chars after the name is read with confidence 0.85; further along the line 0.55. */
function valueAfter(
  segment: string,
  id: MetricId,
): { value: number; confidence: number } | undefined {
  const m = NUMBER.exec(segment.replace(DATE_OR_TIME, (d) => ' '.repeat(d.length)))
  if (m?.[1] === undefined) return undefined
  const value = parseHumanNumber(`${m[1]} ${m[2] ?? ''}`.replace(/\/\s*100/, ''), id)
  if (value === undefined || !plausible(id, value)) return undefined
  return { value, confidence: m.index <= 40 ? 0.85 : 0.55 }
}

function isTableHeader(cells: string[]): boolean {
  return cells.filter((c) => metricForLabel(c)).length >= 2
}

/** Rows below a header with the same cell count; separator rows like |---|---| are dropped. */
function collectTable(
  lines: string[],
  start: number,
  header: string[],
): { rows: string[][]; end: number } {
  const rows: string[][] = [header]
  let end = start
  while (end + 1 < lines.length) {
    const next = splitCells(lines[end + 1] ?? '')
    if (!next || next.length !== header.length) break
    end++
    if (!next.every((c) => /^[-:\s]*$/.test(c))) rows.push(next)
  }
  return { rows, end }
}

/**
 * Walks the text line by line. Tables with a metric header row are read as
 * rows; every other line is scanned for "name value" pairs, taking the route
 * on the same line or the nearest one above.
 */
export function detectMetricsInText(text: string, source: string): DetectedValue[] {
  const lines = text.split(/\r?\n/)
  const detected: DetectedValue[] = []
  let route: string | undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const cells = splitCells(line)
    const table = cells && isTableHeader(cells) ? collectTable(lines, i, cells) : undefined
    if (table && table.rows.length > 1) {
      detected.push(...detectedFromRows(table.rows, source).detected)
      i = table.end
      continue
    }
    const lineRoute = routeInText(line)
    const mentions = mentionsIn(line)
    let hits = 0
    mentions.forEach((m, idx) => {
      const hit = valueAfter(line.slice(m.end, mentions[idx + 1]?.start ?? line.length), m.id)
      if (!hit) return
      hits++
      detected.push({
        metric: m.id,
        value: hit.value,
        route: lineRoute ?? route,
        confidence: hit.confidence,
        source,
      })
    })
    if (lineRoute && hits === 0) route = lineRoute
  }
  return detected
}
