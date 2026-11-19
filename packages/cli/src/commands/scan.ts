import { writeFile } from 'node:fs/promises'

import { loadConfig } from '@perfagent/config'
import { METRICS, formatMetric, metricValue, summarise } from '@perfagent/core'
import { ReportStore, budgetsMarkdown, checkBudgets, runScan } from '@perfagent/engine'

import { flagList, flagNumber, flagString, type ParsedArgs } from '../args.js'
import { color, endProgress, print, progressLine } from '../ui.js'

/** `perfagent scan [url…]`: one scan, printed and saved. `perfagent ci`: same, exits 1 when a budget breaks. */
export async function scan(args: ParsedArgs, ci = false): Promise<void> {
  const { config } = await loadConfig({ overrides: { root: flagString(args.flags, 'root') } })
  const urls = args.positionals.length ? args.positionals : (flagList(args.flags, 'url') ?? config.urls)
  const device = flagString(args.flags, 'device') as 'mobile' | 'desktop' | undefined
  const json = args.flags.json === true
  const started = Date.now()

  const report = await runScan(
    { urls, project: args.flags.project !== false, device, runs: flagNumber(args.flags, 'runs'), label: flagString(args.flags, 'label'), mode: args.flags.project === false ? 'deployed' : 'local' },
    { config, onProgress: json ? undefined : (p) => progressLine(p.message, p.fraction) },
  )
  if (!json) endProgress()
  const store = new ReportStore(config.root)
  await store.save(report)
  const out = flagString(args.flags, 'out')
  if (out) await writeFile(out, JSON.stringify(report, null, 2), 'utf8')

  if (json) {
    print(JSON.stringify(report))
  } else {
    const summary = summarise(report)
    print()
    print(`  ${color.bold(summary.headline)}  ${color.dim(`(${Math.round((Date.now() - started) / 1000)} s, ${report.issues.length} problems, saved as ${report.id})`)}`)
    for (const page of report.pages) {
      print(`\n  ${color.bold(page.route)}  ${color.dim(page.url)}`)
      const row = (['score', 'lcp', 'inp', 'cls', 'ttfb', 'tbt', 'jsKb'] as const).map((id) => {
        const v = metricValue(page.metrics, id)
        return v === undefined ? '' : `${METRICS[id].short} ${color.bold(formatMetric(id, v))}`
      }).filter(Boolean)
      print(`  ${row.join('  ·  ')}`)
    }
    print()
    for (const issue of report.issues.slice(0, 12)) {
      const sev = issue.severity === 'critical' ? color.red('●') : issue.severity === 'warning' ? color.yellow('●') : color.cyan('●')
      print(`  ${sev} ${issue.plain}${issue.location ? color.dim(`  ${issue.location.file}:${issue.location.line}`) : ''}`)
      print(`    ${color.dim(`${issue.fix.steps[0] ?? ''}  (+${issue.gain.scoreDelta} points)`)}`)
    }
    if (report.issues.length > 12) print(`  ${color.dim(`… and ${report.issues.length - 12} more. Open the dashboard with "npx perfagent".`)}`)
  }

  if (ci) {
    const results = checkBudgets(report, config.budgets)
    const failed = results.filter((r) => !r.passed)
    const markdown = budgetsMarkdown(report, results)
    const commentFile = flagString(args.flags, 'comment')
    if (commentFile) await writeFile(commentFile, markdown, 'utf8')
    if (!json) {
      print()
      for (const r of results) print(`  ${r.passed ? color.green('✔') : color.red('✖')} ${r.message}`)
    }
    if (failed.length) {
      print(`\n  ${color.red(`${failed.length} budget${failed.length > 1 ? 's' : ''} over limit`)}`)
      process.exitCode = 1
    }
  }
}
