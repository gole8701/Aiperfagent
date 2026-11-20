import type { PerfAgentConfigInput } from './schema.js'

export {
  configSchema,
  budgetSchema,
  DEFAULT_CONFIG,
  editorIds,
  aiProviders,
  themes,
} from './schema.js'
export type { PerfAgentConfig, PerfAgentConfigInput, BudgetConfig } from './schema.js'
export { loadConfig, findConfigFile, envOverrides, deepMerge, CONFIG_FILES } from './load.js'
export type { LoadOptions, LoadedConfig } from './load.js'
export { describeConfig } from './describe.js'
export type { OptionDoc } from './describe.js'

/** Gives editors type hints in `perfagent.config.ts`. Returns the input unchanged. */
export function defineConfig(config: PerfAgentConfigInput): PerfAgentConfigInput {
  return config
}

export const CONFIG_TEMPLATE = `// A plain object, so it also works with "npx perfagent" when the package is not installed.
/** @type {import('perfagent').PerfAgentConfigInput} */
export default {
  // Pages to measure. Leave empty to paste URLs in the dashboard.
  urls: ['http://localhost:3000'],
  root: '.',
  device: 'mobile',
  runs: 3,
  editor: 'auto',
  theme: 'system',
  budgets: {
    // '/checkout': { lcp: 2500, inp: 200, js: '200kb' },
  },
  ai: {
    // 'ollama' is free and runs on your machine. Keys for other providers are
    // stored in your OS keychain through the dashboard, never in this file.
    provider: 'none',
    sendCode: 'snippets',
    monthlyBudgetUsd: 20,
  },
  fix: {
    review: true,
    autoCommit: false,
    protected: [],
  },
}
`
