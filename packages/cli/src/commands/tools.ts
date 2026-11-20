import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { loadConfig } from '@perfagent/config'
import { PerfAgentError, compareReports } from '@perfagent/core'
import { PERFAGENT_VERSION, ReportStore } from '@perfagent/engine'

import { flagNumber, flagString, type ParsedArgs } from '../args.js'
import { guidesDir } from '../paths.js'
import { color, print } from '../ui.js'

/** `perfagent import <file>`: converts any supported report into the local store. */
export async function importCommand(args: ParsedArgs): Promise<void> {
  const file = args.positionals[0]
  if (!file)
    throw new PerfAgentError(
      'IMPORT_INVALID',
      'Give a file to import',
      'perfagent import ./lighthouse.json',
    )
  const { config } = await loadConfig({ overrides: { root: flagString(args.flags, 'root') } })
  const { importReport } = await import('@perfagent/importers')
  const result = await importReport({ buffer: await readFile(file), filename: path.basename(file) })
  await new ReportStore(config.root).save(result.report)
  print(
    `  ${color.green('✔')} Imported as ${result.format} (${result.exact ? 'exact' : 'best-effort'}), saved as ${result.report.id}`,
  )
  for (const w of result.warnings) print(`  ${color.yellow('!')} ${w}`)
  for (const d of result.detected.filter((d) => d.confidence < 0.7))
    print(
      `  ${color.yellow('?')} ${d.metric} = ${d.value} read with low confidence (${d.source}); check it in the dashboard`,
    )
}

/** `perfagent export <reportId|latest> --format json|csv|md|html --out file`. */
export async function exportCommand(args: ParsedArgs): Promise<void> {
  const { config } = await loadConfig({ overrides: { root: flagString(args.flags, 'root') } })
  const store = new ReportStore(config.root)
  const id = args.positionals[0] ?? 'latest'
  const report = id === 'latest' ? await store.latest() : await store.get(id)
  if (!report)
    throw new PerfAgentError('NOT_FOUND', 'No report to export', 'Run "perfagent scan" first.')
  const { exportReport } = await import('@perfagent/server')
  const format = (flagString(args.flags, 'format') ?? 'json') as 'json' | 'csv' | 'md' | 'html'
  const out = exportReport(report, format)
  const target = flagString(args.flags, 'out') ?? out.filename
  await writeFile(target, out.body, 'utf8')
  print(`  ${color.green('✔')} Wrote ${target}`)
}

/** `perfagent compare <a> <b>`: ids from the store, or files. */
export async function compareCommand(args: ParsedArgs): Promise<void> {
  const [a, b] = args.positionals
  if (!a || !b)
    throw new PerfAgentError(
      'IMPORT_INVALID',
      'Give two reports to compare',
      'perfagent compare before.json after.json',
    )
  const { config } = await loadConfig({ overrides: { root: flagString(args.flags, 'root') } })
  const store = new ReportStore(config.root)
  const { importReport } = await import('@perfagent/importers')
  const load = async (ref: string) =>
    ref.includes('.') || ref.includes('/')
      ? (await importReport({ buffer: await readFile(ref), filename: path.basename(ref) })).report
      : store.get(ref)
  const result = compareReports(await load(a), await load(b))
  print(`\n  ${color.bold(`${result.verdict.scoreFrom} → ${result.verdict.scoreTo}`)}`)
  for (const s of result.verdict.sentences) print(`  ${s}`)
  print()
  for (const d of result.diffs.filter((d) => d.direction !== 'same'))
    print(
      `  ${d.direction === 'better' ? color.green('▲') : color.red('▼')} ${d.metric.padEnd(10)} ${String(d.from).padStart(8)} → ${String(d.to).padEnd(8)} ${d.label}`,
    )
  for (const i of result.impact.slice(0, 8))
    print(
      `  ${i.kind === 'new' ? color.red('new') : i.kind === 'fixed' ? color.green('fixed') : color.dim(i.kind)}  ${i.plain}${i.issue?.location ? color.dim(`  ${i.issue.location.file}:${i.issue.location.line}`) : ''}`,
    )
  for (const w of result.warnings) print(`  ${color.yellow('!')} ${w}`)
}

/** `perfagent mcp [--http --port 4546]`: run as an MCP server. */
export async function mcpCommand(args: ParsedArgs): Promise<void> {
  const { config } = await loadConfig({ overrides: { root: flagString(args.flags, 'root') } })
  const store = new ReportStore(config.root)
  const [{ startMcpServer }, { createAiService }, { createFixService }] = await Promise.all([
    import('@perfagent/mcp'),
    import('@perfagent/ai'),
    import('@perfagent/fixer'),
  ])
  const ai = createAiService({ config, store })
  const fix = createFixService({ config, store, ai })
  await startMcpServer({
    config,
    store,
    ai,
    fix,
    transport: args.flags.http === true ? 'http' : 'stdio',
    port: flagNumber(args.flags, 'port'),
    host: flagString(args.flags, 'host'),
    allowWrites: args.flags['allow-writes'] === true,
    guidesDir: await guidesDir(),
    version: PERFAGENT_VERSION,
  })
}

/** `perfagent ai-proxy --target https://api.openai.com --port 4547`: measure an app's AI calls with zero code change. */
export async function aiProxyCommand(args: ParsedArgs): Promise<void> {
  const target = flagString(args.flags, 'target')
  if (!target)
    throw new PerfAgentError(
      'CONFIG_INVALID',
      'Give the provider base URL',
      'perfagent ai-proxy --target https://api.openai.com --port 4547',
    )
  const { config } = await loadConfig({ overrides: { root: flagString(args.flags, 'root') } })
  const { createAiProxy } = await import('@perfagent/ai')
  const proxy = await createAiProxy({
    targetBaseUrl: target,
    port: flagNumber(args.flags, 'port') ?? 4547,
    file: path.join(config.root, '.perfagent', 'ai-samples.jsonl'),
    logPrompts: config.ai.logPrompts,
  })
  print()
  print(`  ${color.bold('AI proxy:')} ${color.cyan(proxy.url)} → ${target}`)
  print(
    `  ${color.dim('Point OPENAI_BASE_URL / ANTHROPIC_BASE_URL at it; samples go to .perfagent/ai-samples.jsonl. Stop with Ctrl+C')}`,
  )
  print()
  const stop = async (): Promise<void> => {
    await proxy.close()
    process.exit(0)
  }
  process.on('SIGINT', () => {
    void stop()
  })
  process.on('SIGTERM', () => {
    void stop()
  })
  await new Promise(() => undefined)
}
