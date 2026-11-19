import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import type { AiService, ReportStore } from '@perfagent/engine'

export interface AiServiceOptions {
  config: PerfAgentConfig
  store: ReportStore
}

/** Contract stub: the real implementation lives in ./service.ts and replaces this export. */
export function createAiService(_options: AiServiceOptions): AiService {
  const notReady = (): never => {
    throw new PerfAgentError('AI_NOT_CONFIGURED', 'AI service is not built yet')
  }
  return {
    providers: () => Promise.resolve([]),
    testConnection: notReady,
    storeKey: notReady,
    removeKey: notReady,
    explain: notReady,
    proposeFix: notReady,
    summarise: notReady,
    usage: () => Promise.resolve({ monthUsd: 0, calls: 0 }),
    activeProvider: () => Promise.resolve('rules'),
  }
}
