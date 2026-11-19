import { METRICS, formatMetric, summarise, type Report } from '@perfagent/core'

export type ExportFormat = 'json' | 'csv' | 'md' | 'html'

export function exportReport(report: Report, format: ExportFormat): { body: string; contentType: string; filename: string } {
  const base = `perfagent-report-${report.id}`
  switch (format) {
    case 'json':
      return { body: JSON.stringify(report, null, 2), contentType: 'application/json', filename: `${base}.json` }
    case 'csv':
      return { body: toCsv(report), contentType: 'text/csv', filename: `${base}.csv` }
    case 'md':
      return { body: toMarkdown(report), contentType: 'text/markdown', filename: `${base}.md` }
    case 'html':
      return { body: toHtml(report), contentType: 'text/html', filename: `${base}.html` }
  }
}

function toCsv(report: Report): string {
  const rows: string[][] = [['page', 'metric', 'value', 'unit', 'rating']]
  for (const page of report.pages) for (const m of page.metrics) rows.push([page.route, m.id, String(m.value), m.unit, ''])
  rows.push([], ['severity', 'title', 'plain', 'file', 'line', 'metric', 'gain_points', 'first_step'])
  for (const i of report.issues) rows.push([i.severity, i.title, i.plain, i.location?.file ?? '', String(i.location?.line ?? ''), i.gain.metric, String(i.gain.scoreDelta), i.fix.steps[0] ?? ''])
  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Markdown ready to paste into a pull request or ticket. */
export function toMarkdown(report: Report): string {
  const summary = summarise(report)
  const lines = [`# PerfAgent report: ${report.label ?? report.environment.name}`, '', `_${new Date(report.createdAt).toLocaleString()} · ${report.environment.device} · ${report.environment.mode} mode_`, '', `**${summary.headline}.** ${summary.sentences.join(' ')}`, '']
  for (const page of report.pages) {
    lines.push(`## ${page.route}`, '', '| Metric | Value | Rating |', '|---|---|---|')
    for (const m of page.metrics) lines.push(`| ${METRICS[m.id].short} | ${formatMetric(m.id, m.value)} | ${ratingWord(m.id, m.value)} |`)
    lines.push('')
  }
  const open = report.issues.filter((i) => i.status === 'open')
  lines.push(`## Problems (${open.length})`, '')
  for (const i of open) {
    lines.push(`### ${sevIcon(i.severity)} ${i.title}`, '', i.plain + (i.location ? ` — \`${i.location.file}:${i.location.line}\`` : ''), '', `**Why:** ${i.why}`, '', `**Fix:**`, ...i.fix.steps.map((s) => `1. ${s}`), '')
    if (i.fix.changes[0]) lines.push('```diff', ...i.fix.changes[0].before.split('\n').map((l) => `- ${l}`), ...i.fix.changes[0].after.split('\n').map((l) => `+ ${l}`), '```', '')
  }
  return lines.join('\n')
}

function toHtml(report: Report): string {
  const md = toMarkdown(report)
  const escaped = md.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)
  // Single, offline HTML file. Data is embedded as text, never executed.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PerfAgent report</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#111}pre{white-space:pre-wrap;background:#f4f4f5;padding:16px;border-radius:8px}</style></head><body><pre>${escaped}</pre><script type="application/json" id="perfagent-data">${JSON.stringify(report).replace(/</g, '\\u003c')}</script></body></html>`
}

function ratingWord(id: Report['pages'][number]['metrics'][number]['id'], value: number): string {
  const m = METRICS[id]
  if (m.good === null || m.poor === null) return '—'
  const good = m.lowerIsBetter ? value <= m.good : value >= m.good
  const poor = m.lowerIsBetter ? value > m.poor : value < m.poor
  return good ? 'good' : poor ? 'poor' : 'needs work'
}

function sevIcon(s: string): string {
  return s === 'critical' ? '🔴' : s === 'warning' ? '🟠' : '🔵'
}
