// A plain object, so it also works with "npx perfagent" when the package is not installed.
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
