import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import type { AiService, FixService, ReportStore } from '@perfagent/engine'

export interface FixServiceOptions {
  config: PerfAgentConfig
  store: ReportStore
  ai: AiService
}

/** Contract stub: the real implementation lives in ./service.ts and replaces this export. */
export function createFixService(_options: FixServiceOptions): FixService {
  const notReady = (): never => {
    throw new PerfAgentError('FIX_REJECTED', 'Fix service is not built yet')
  }
  return { start: notReady, get: () => undefined, list: () => [], accept: notReady, skip: notReady, undo: notReady }
}
