import { execFile } from 'node:child_process'

import { loadConfig } from '@perfagent/config'
import { PERFAGENT_VERSION, ReportStore } from '@perfagent/engine'

import { flagNumber, flagString, type ParsedArgs } from '../args.js'
import { agentScriptPath, dashboardDir, guidesDir } from '../paths.js'
import { color, print } from '../ui.js'

/** `npx perfagent` (default): starts the local dashboard and opens the browser. */
export async function start(args: ParsedArgs): Promise<void> {
  const port = flagNumber(args.flags, 'port')
  const { config } = await loadConfig({ overrides: { server: port ? { port } : undefined, root: flagString(args.flags, 'root') } })
  const store = new ReportStore(config.root)
  const overlay = await store.readJson<Record<string, unknown>>('settings.json', {})
  if (Object.keys(overlay).length) Object.assign(config, (await import('@perfagent/config')).configSchema.parse((await import('@perfagent/config')).deepMerge(config as unknown as Record<string, unknown>, overlay)), { root: config.root })

  const [{ createServer }, { createAiService }, { createFixService }] = await Promise.all([import('@perfagent/server'), import('@perfagent/ai'), import('@perfagent/fixer')])
  const ai = createAiService({ config, store })
  const fix = createFixService({ config, store, ai })
  const server = await createServer({ config, dashboardDir: await dashboardDir(), guidesDir: await guidesDir(), agentScriptPath: await agentScriptPath(), ai, fix, version: PERFAGENT_VERSION, devOrigins: flagString(args.flags, 'dev-origin') ? [flagString(args.flags, 'dev-origin') ?? ''] : undefined })

  print()
  print(`  ${color.bold('Dashboard:')} ${color.cyan(server.url)}`)
  print(`  ${color.dim('Mode:')} ${server.mode.mode === 'local' ? color.green('local (can open files and apply fixes)') : color.yellow(`suggest-only: ${server.mode.reasons.join('; ')}`)}`)
  print(`  ${color.dim('Project:')} ${config.root}`)
  print(`  ${color.dim('Stop with Ctrl+C')}`)
  print()

  if (config.server.open && args.flags.open !== false) openBrowser(server.url)

  const stop = async (): Promise<void> => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', () => { void stop() })
  process.on('SIGTERM', () => { void stop() })
  await new Promise(() => undefined)
}

function openBrowser(url: string): void {
  const [bin, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]
  execFile(bin, args, () => undefined)
}
