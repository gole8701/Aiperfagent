import { PerfAgentError } from '@perfagent/core'
import { chromium, firefox, webkit, type Browser, type BrowserType } from 'playwright-core'

export type BrowserName = 'chromium' | 'firefox' | 'webkit'

/**
 * Prefers the Chrome already on the machine (no 150 MB download), falls back
 * to the Playwright-managed browser when the optional `playwright` package
 * installed one.
 */
export async function launchBrowser(name: BrowserName = 'chromium'): Promise<Browser> {
  const type: BrowserType = name === 'firefox' ? firefox : name === 'webkit' ? webkit : chromium
  const attempts: Parameters<BrowserType['launch']>[0][] =
    name === 'chromium'
      ? [
          { channel: 'chrome', headless: true },
          { channel: 'msedge', headless: true },
          { headless: true },
        ]
      : [{ headless: true }]
  let lastError: unknown
  for (const options of attempts) {
    try {
      return await type.launch(options)
    } catch (error) {
      lastError = error
    }
  }
  throw new PerfAgentError(
    'BROWSER_MISSING',
    `No ${name} browser found to run the scan.`,
    name === 'chromium'
      ? 'Install Google Chrome, or run "npx playwright install chromium".'
      : `Run "npx playwright install ${name}".`,
  ).withCause(lastError)
}

declare module '@perfagent/core' {
  interface PerfAgentError {
    withCause(cause: unknown): PerfAgentError
  }
}
PerfAgentError.prototype.withCause = function withCause(
  this: PerfAgentError,
  cause: unknown,
): PerfAgentError {
  ;(this as { cause?: unknown }).cause = cause
  return this
}
