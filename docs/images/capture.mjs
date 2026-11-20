// Captures the README screenshots from a running dashboard (see README.md in this folder).
// PERFAGENT_TOKEN=<token> node docs/images/capture.mjs [http://127.0.0.1:4545]
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// playwright-core is a dependency of the collectors package, not of the repo root.
const require = createRequire(path.join(here, '../../packages/collectors/package.json'))
const { chromium } = require('playwright-core')

const base = process.argv[2] ?? 'http://127.0.0.1:4545'
const token = process.env.PERFAGENT_TOKEN
if (!token) throw new Error('Set PERFAGENT_TOKEN to the token printed by "perfagent"')

const shots = {
  globe: async (page) => {
    await page.goto('/')
    await page.locator('canvas.globe-canvas').waitFor({ state: 'attached' })
    await page.waitForTimeout(4000) // let the intro spin settle
  },
  'deep-dive': async (page) => {
    await page.goto(
      `/issues/${encodeURIComponent('general/lcp-image-lazy@src/components/HeroBanner.tsx:5')}`,
    )
    await page.getByRole('region', { name: 'Where' }).waitFor()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2500) // the globe flies to the problem
  },
  flow: async (page) => {
    await page.goto('/flow/src/components')
    await page.locator('.flow-node').first().waitFor()
    await page.waitForTimeout(2000)
  },
  charts: async (page) => {
    await page.goto('/charts/overview')
    await page.locator('.chart-card canvas').first().waitFor()
    await page.waitForTimeout(1500)
  },
  compare: async (page) => {
    await page.goto('/compare')
    await page.getByRole('combobox').nth(1).locator('option').nth(2).waitFor({ state: 'attached' })
    const [a, b] = await page.getByRole('combobox').all()
    const options = await a.locator('option').evaluateAll((o) =>
      o
        // Only this project's own scans: URL scans of other sites must not end up in public screenshots.
        .filter((x) => x.value && x.textContent.startsWith('Project'))
        .map((x) => ({
          value: x.value,
          score: Number(/score (\d+)/.exec(x.textContent)?.[1] ?? 0),
        })),
    )
    options.sort((x, y) => x.score - y.score)
    // Lowest score as "before", highest as "after": shows what an improvement looks like.
    await a.selectOption(options[0].value)
    await b.selectOption(options.at(-1).value)
    await page.getByRole('button', { name: 'Compare', exact: true }).click()
    await page.getByText('In simple words').first().waitFor()
    await page.waitForTimeout(1000)
  },
  guide: async (page) => {
    await page.goto('/guide/lcp')
    // Pause the animation (hover) right after the big picture has painted.
    await page.getByText('Largest Contentful Paint').first().waitFor({ timeout: 20_000 })
    await page.waitForTimeout(600) // let the picture fade in
    await page.locator('svg', { hasText: 'Largest Contentful Paint' }).first().hover()
    await page.waitForTimeout(200)
  },
  'settings-ai': async (page) => {
    await page.goto('/settings/ai')
    await page.getByText('Use the AI you already pay for').waitFor()
    await page.getByRole('button', { name: /Cursor/ }).click()
    await page.waitForTimeout(500)
  },
}

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
})
const first = await context.newPage()
await first.goto(`/?token=${token}`)
// The app moves the token from the URL to session storage; later pages in this tab reuse it.
await first.waitForFunction(() => sessionStorage.length > 0)
for (const [name, run] of Object.entries(shots)) {
  await run(first)
  await first.screenshot({ path: path.join(here, `${name}.jpg`), type: 'jpeg', quality: 88 })
  console.log(`✔ ${name}.jpg`)
}
await browser.close()
