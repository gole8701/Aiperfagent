import { defineConfig } from '@playwright/test'

/** Runs against the static build (sample report, no server), so the suite needs nothing else running. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1400, height: 900 } },
  webServer: {
    command: 'pnpm run preview:static',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
