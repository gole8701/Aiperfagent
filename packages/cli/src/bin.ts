#!/usr/bin/env node
import { isPerfAgentError } from '@perfagent/core'

import { parseArgs } from './args.js'
import { color, print, printError } from './ui.js'

const VERSION = '0.1.0'

const HELP = `
  ${color.bold('perfagent')}                 start the local dashboard (default)
  ${color.bold('perfagent init')}            create perfagent.config.ts
  ${color.bold('perfagent scan')} [url…]     measure pages + scan the project, print problems
  ${color.bold('perfagent ci')}              scan and fail when a budget is over its limit (--comment file.md for a PR comment)
  ${color.bold('perfagent import')} <file>   import Lighthouse / HAR / PDF / Excel / Word / CSV / PerfAgent JSON
  ${color.bold('perfagent export')} [id]     export a report (--format json|csv|md|html --out file)
  ${color.bold('perfagent compare')} <a> <b> compare two reports (ids or files)
  ${color.bold('perfagent mcp')}             run as an MCP server for Claude Code, Cursor, Copilot… (--http --port 4546 --host 127.0.0.1 for remote)
  ${color.bold('perfagent ai-proxy')}        measure your app's AI calls with no code change (--target https://api.openai.com --port 4547)

  Options: --port 4545  --root .  --device mobile|desktop  --runs 3  --no-project  --json  --no-open
  Docs: https://github.com/gole8701/Aiperfagent
`

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.flags.version === true || args.command === 'version') {
    print(VERSION)
    return
  }
  if (args.flags.help === true || args.command === 'help') {
    print(HELP)
    return
  }
  // Heavy modules load only for the command that needs them, so `--help` stays fast.
  switch (args.command) {
    case 'start':
    case 'serve':
    case 'dashboard':
      return (await import('./commands/start.js')).start(args)
    case 'init':
      return (await import('./commands/init.js')).init(args)
    case 'scan':
      return (await import('./commands/scan.js')).scan(args)
    case 'ci':
      return (await import('./commands/scan.js')).scan(args, true)
    case 'import':
      return (await import('./commands/tools.js')).importCommand(args)
    case 'export':
      return (await import('./commands/tools.js')).exportCommand(args)
    case 'compare':
      return (await import('./commands/tools.js')).compareCommand(args)
    case 'mcp':
      return (await import('./commands/tools.js')).mcpCommand(args)
    case 'ai-proxy':
      return (await import('./commands/tools.js')).aiProxyCommand(args)
    default:
      printError(`Unknown command "${args.command}"`, 'Run "perfagent --help" to see the commands.')
      process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  if (isPerfAgentError(error)) printError(error.message, error.hint)
  else printError(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
