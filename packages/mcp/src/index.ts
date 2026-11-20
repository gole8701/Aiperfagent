import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { PerfAgentConfig } from '@perfagent/config'
import type { AiService, FixService, ReportStore } from '@perfagent/engine'
import { detectMode } from '@perfagent/security'

import { startHttpTransport } from './http.js'
import { buildMcpServer } from './tools.js'

export interface McpServerOptions {
  config: PerfAgentConfig
  store: ReportStore
  ai?: AiService
  fix?: FixService
  transport: 'stdio' | 'http'
  port?: number
  /** HTTP bind address; 127.0.0.1 unless the user opts into 0.0.0.0. */
  host?: string
  /** Enables the optional write tool `apply_fix_to_branch`. Off by default. */
  allowWrites?: boolean
  /** Folder with the guide Markdown files for `perfagent://guide/<topic>`. */
  guidesDir?: string
  version: string
}

/** Runs until the client disconnects (stdio) or the process is stopped (HTTP). */
export async function startMcpServer(options: McpServerOptions): Promise<void> {
  if (options.allowWrites && !(await writesAllowed(options)))
    options = { ...options, allowWrites: false }
  if (options.transport === 'http') {
    await startHttpTransport(options)
    return
  }
  const server = buildMcpServer(options)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // stdout is the protocol channel; humans read stderr.
  process.stderr.write(
    `PerfAgent MCP server ready (stdio, ${options.allowWrites ? 'writes enabled' : 'read-only'})\n`,
  )
  await new Promise<void>((resolve) => {
    transport.onclose = resolve
  })
}

/** The write tool follows the dashboard's rule: local mode only (loopback, git repo, not production). */
export async function writesAllowed(
  options: Pick<McpServerOptions, 'config' | 'transport' | 'host'>,
): Promise<boolean> {
  const bindHost = options.transport === 'http' ? (options.host ?? '127.0.0.1') : '127.0.0.1'
  const { mode, reasons } = await detectMode({ root: options.config.root, bindHost })
  if (mode === 'local') return true
  process.stderr.write(`--allow-writes ignored, not in local mode: ${reasons.join('; ')}\n`)
  return false
}

export { buildMcpServer } from './tools.js'
