import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import type { AiService, FixService, ReportStore } from '@perfagent/engine'

export interface McpServerOptions {
  config: PerfAgentConfig
  store: ReportStore
  ai?: AiService
  fix?: FixService
  transport: 'stdio' | 'http'
  port?: number
  /** Enables the optional write tool `apply_fix_to_branch`. Off by default. */
  allowWrites?: boolean
  version: string
}

/** Contract stub: the real implementation lives in ./server.ts and replaces this export. */
export function startMcpServer(_options: McpServerOptions): Promise<void> {
  return Promise.reject(new PerfAgentError('NOT_FOUND', 'MCP server is not built yet'))
}
