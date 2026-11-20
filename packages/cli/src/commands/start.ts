import { execFile } from 'node:child_process'

import { findConfigFile, loadConfig } from '@perfagent/config'
import { PERFAGENT_VERSION, ReportStore } from '@perfagent/engine'

import { flagNumber, flagString, type ParsedArgs } from '../args.js'
import { agentScriptPath, dashboardDir, guidesDir } from '../paths.js'
import { color, print } from '../ui.js'

/**
 * `npx perfagent` (default): starts the local dashboard and opens the browser.
 * On the first run it also creates the config and starts a scan, so one command is enough.
 */
export async function start(args: ParsedArgs): Promise<void> {
  const port = flagNumber(args.flags, 'port')
  if (!(await findConfigFile(flagString(args.flags, 'root') ?? process.cwd())))
    await (await import('./init.js')).init(args)
  const { config } = await loadConfig({
    overrides: { server: port ? { port } : undefined, root: flagString(args.flags, 'root') },
  })
  const store = new ReportStore(config.root)
  const overlay = await store.readJson<Record<string, unknown>>('settings.json', {})
  if (Object.keys(overlay).length)
    Object.assign(
      config,
      (await import('@perfagent/config')).configSchema.parse(
        (await import('@perfagent/config')).deepMerge(
          config as unknown as Record<string, unknown>,
          overlay,
        ),
      ),
      { root: config.root },
    )

  const firstRun = !(await store.latest())
  if (firstRun) config.urls = await reachableUrls(config.urls)

  const [{ createServer }, { createAiService }, { createFixService }] = await Promise.all([
    import('@perfagent/server'),
    import('@perfagent/ai'),
    import('@perfagent/fixer'),
  ])
  const ai = createAiService({ config, store })
  const fix = createFixService({ config, store, ai })
  const server = await createServer({
    config,
    dashboardDir: await dashboardDir(),
    guidesDir: await guidesDir(),
    agentScriptPath: await agentScriptPath(),
    ai,
    fix,
    version: PERFAGENT_VERSION,
    devOrigins: flagString(args.flags, 'dev-origin')
      ? [flagString(args.flags, 'dev-origin') ?? '']
      : undefined,
  })

  print()
  print(`  ${color.bold('Dashboard:')} ${color.cyan(server.url)}`)
  print(
    `  ${color.dim('Mode:')} ${server.mode.mode === 'local' ? color.green('local (can open files and apply fixes)') : color.yellow(`suggest-only: ${server.mode.reasons.join('; ')}`)}`,
  )
  print(`  ${color.dim('Project:')} ${config.root}`)
  print(`  ${color.dim('Stop with Ctrl+C')}`)
  print()

  if (firstRun) {
    print(
      `  ${color.cyan('First run:')} scanning ${config.urls.length ? config.urls.join(', ') : 'your project files (no running dev server found)'}. Results appear in the dashboard.`,
    )
    print()
    void startFirstScan(server.url, server.token)
  }
  if (config.server.open && args.flags.open !== false) openBrowser(server.url)

  const stop = async (): Promise<void> => {
    await server.close()
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

function openBrowser(url: string): void {
  const [bin, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]]
  execFile(bin, args, () => undefined)
}

/** Common dev-server ports, tried when the configured URLs are not answering. */
const DEV_PORTS = [3000, 5173, 8080, 4200, 4321, 8000]

/** Keeps the configured URLs that answer; otherwise picks the first local dev server found. */
export async function reachableUrls(configured: string[]): Promise<string[]> {
  const up = (await Promise.all(configured.map(async (u) => ((await answers(u)) ? u : undefined)))).filter(
    (u): u is string => Boolean(u),
  )
  if (up.length) return up
  for (const p of DEV_PORTS) {
    const url = `http://localhost:${p}`
    if (await answers(url)) return [url]
  }
  return []
}

async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(800), redirect: 'manual' })
    return true
  } catch {
    return false
  }
}

/** Queues the first scan through the server, so the dashboard shows its progress live. */
async function startFirstScan(dashboardUrl: string, token: string): Promise<void> {
  try {
    const res = await fetch(new URL('/api/scans', dashboardUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) print(`  ${color.yellow('!')} First scan did not start (${res.status}). Press Scan in the dashboard.`)
  } catch {
    print(`  ${color.yellow('!')} First scan did not start. Press Scan in the dashboard.`)
  }
}
