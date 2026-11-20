// Captures the real dashboard screenshots used by the in-app guide, plus the
// position of every control the guide points at (as % of the image).
//
// Run from packages/collectors so playwright-core resolves, with the dashboard
// running on the demo-shop report:
//   node ../../docs/guides/capture-shots.mjs "<dashboard url with token>"
// Writes packages/web/public/guide/*.webp and packages/web/src/features/guide/shots.ts.
// ONLY=home,issue re-captures some shots and keeps the others.
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = createRequire(path.join(process.cwd(), 'noop.js'))('playwright-core')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.join(root, 'packages/web/public/guide')
const dataFile = path.join(root, 'packages/web/src/features/guide/shots.ts')
const W = 1440
const H = 900
const QUALITY = Number(process.env.QUALITY ?? 0.62)

const dashboard = process.argv[2]
if (!dashboard) throw new Error('Pass the dashboard URL (with its token) as the first argument')

const go = (page, route) =>
  page.evaluate((r) => {
    history.pushState({}, '', r)
    dispatchEvent(new PopStateEvent('popstate'))
  }, route)
const card = (page, title) =>
  page
    .locator('section.card')
    .filter({ has: page.locator('.card-title', { hasText: title }) })
    .first()
const button = (page, name, exact = true) => page.getByRole('button', { name, exact }).first()
const link = (page, name, exact = true) => page.getByRole('link', { name, exact }).first()
const chip = (page, group, label) =>
  page
    .getByRole('group', { name: group })
    .getByRole('button', { name: new RegExp(`^${label}\\s*\\d`) })
/** A full-width row of a card, found by a control inside it. */
const row = (page, cardTitle, inner) => async () => {
  const c = await card(page, cardTitle).boundingBox()
  const r = await inner.boundingBox()
  return c && r && { x: c.x + 6, y: r.y - 8, width: c.width - 12, height: r.height + 16 }
}

const SHOTS = [
  {
    id: 'home',
    route: '/',
    targets: (p) => ({
      url: p.getByPlaceholder('Paste any URL to test'),
      scan: button(p, 'Scan'),
      live: p.getByRole('link', { name: 'Live', exact: true }).last(),
      theme: p.getByLabel('Theme').first(),
      export: button(p, 'Export'),
      score: p.locator('[aria-label^="Performance score"]').first(),
      vitals: card(p, 'Core Web Vitals'),
      lcp: row(p, 'Core Web Vitals', link(p, /Largest Contentful Paint/, false)),
      inp: row(p, 'Core Web Vitals', link(p, /Interaction to Next Paint/, false)),
      cls: row(p, 'Core Web Vitals', link(p, /Cumulative Layout Shift/, false)),
      ttfb: row(p, 'Core Web Vitals', link(p, /Time to First Byte/, false)),
      fcp: row(p, 'Core Web Vitals', link(p, /First Contentful Paint/, false)),
      tbt: row(p, 'Core Web Vitals', link(p, /Total Blocking Time/, false)),
      problems: card(p, 'Problems found'),
      chips: p.getByRole('group', { name: 'Filter by metric' }),
      chipLcp: chip(p, 'Filter by metric', 'LCP'),
      chipInp: chip(p, 'Filter by metric', 'INP'),
      chipCls: chip(p, 'Filter by metric', 'CLS'),
      chipTtfb: chip(p, 'Filter by metric', 'TTFB'),
      chipTbt: chip(p, 'Filter by metric', 'TBT'),
      chipFcp: chip(p, 'Filter by metric', 'FCP'),
      chipToken: chip(p, 'Filter by metric', 'First token'),
      chipCost: chip(p, 'Filter by metric', 'AI cost'),
      chipAgents: chip(p, 'Filter by metric', 'Agent(?:s| score)'),
      globe: p.locator('canvas').first(),
      globeControls: button(p, 'Reset view'),
      facts: p.locator('.corner-cards'),
      chartsLink: link(p, 'Open charts view'),
      navFlow: p.locator('header').getByRole('link', { name: 'Flow diagram' }),
      navCharts: p.locator('header').getByRole('link', { name: 'Charts' }),
      navCompare: p.locator('header').getByRole('link', { name: 'Compare' }),
      navSettings: p.locator('header').getByRole('link', { name: 'Settings' }),
      guide: p.locator('.help-button'),
      mode: p.getByText(/· local mode/).first(),
    }),
  },
  {
    id: 'home-list',
    route: '/',
    prepare: async (p) => {
      const table = p.locator('[aria-label="All problems"]')
      const box = await table.boundingBox()
      await p.evaluate((y) => window.scrollTo(0, y - 420), box.y)
    },
    targets: (p) => ({
      areas: p.getByRole('group', { name: 'Filter by area' }),
      chipBundle: chip(p, 'Filter by area', 'Bundle'),
      chipJs: chip(p, 'Filter by area', 'JavaScript'),
      chipMemory: chip(p, 'Filter by area', 'Memory'),
      chipSocket: chip(p, 'Filter by area', 'WebSocket'),
      chipServer: chip(p, 'Filter by area', 'Server'),
      chipAi: chip(p, 'Filter by area', 'AI'),
      table: p.locator('[aria-label="All problems"]'),
      heroRow: p.getByRole('row').filter({ hasText: 'Your main picture loads late' }).first(),
    }),
  },
  {
    id: 'export',
    route: '/',
    prepare: async (p) => {
      await button(p, 'Export').click()
      await p.waitForTimeout(500)
    },
    targets: (p) => ({
      export: button(p, 'Export'),
      menu: p.getByText('JSON (re-importable)').locator('xpath=..'),
      json: p.getByText('JSON (re-importable)'),
      markdown: p.getByText('Markdown (PR comment)'),
      html: p.getByText('Single HTML file'),
      pdf: p.getByText('PDF (print)'),
      theme: p.getByLabel('Theme').first(),
    }),
  },
  {
    id: 'issue',
    route: '/',
    prepare: async (p) => {
      await p.getByText('Your main picture loads late').first().click()
      await p.waitForTimeout(1500)
      await p.evaluate(() => window.scrollTo(0, 0))
      await p.waitForTimeout(500)
    },
    targets: (p) => ({
      title: p.getByRole('heading', { name: 'Your main picture loads late' }),
      where: p.locator('section[aria-label="Where"]'),
      editor: button(p, 'Open in editor at this line'),
      flowLink: link(p, 'Show this file in the flow diagram'),
      chain: p.locator('section[aria-label="Evidence · root cause chain"]'),
      close: button(p, 'Close deep dive'),
    }),
  },
  {
    id: 'issue-fix',
    route: '/',
    prepare: async (p) => {
      await p.getByText('Your main picture loads late').first().click()
      await p.waitForTimeout(1500)
      await p.evaluate(() => window.scrollTo(0, 0))
      await p.locator('section[aria-label="If you apply this fix (estimate)"]').evaluate((el) => {
        let box = el.parentElement
        while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY))
          box = box.parentElement
        if (box) box.scrollTop = el.offsetTop - 140
      })
      await p.waitForTimeout(500)
    },
    targets: (p) => ({
      gain: p.locator('section[aria-label="If you apply this fix (estimate)"]'),
      steps: p.locator('section[aria-label="How to fix, step by step"]'),
      builtIn: button(p, 'Built-in fix · apply'),
      aiFix: button(p, 'Fix with my AI'),
      explain: button(p, 'Explain with AI'),
      verify: p.locator('section[aria-label="Verify"]'),
      retest: button(p, 'Re-test to verify'),
      budget: p.locator('section[aria-label="Stop it coming back"]'),
      addConfig: button(p, 'Add to config'),
      markFixed: button(p, 'Mark as fixed'),
    }),
  },
  {
    id: 'flow',
    route: '/flow',
    prepare: async (p) => {
      await p
        .getByLabel('Project flow diagram')
        .getByText('src', { exact: true })
        .first()
        .click({ timeout: 5000 })
        .catch(() => console.warn('  flow: src node not found'))
      await p.waitForTimeout(1500)
    },
    targets: (p) => ({
      search: p.getByPlaceholder('Find a file or component'),
      expand: button(p, 'Expand all'),
      problemsOnly: p.getByText('Problems only').first(),
      canvas: p.getByLabel('Project flow diagram'),
      node: p.getByLabel('Project flow diagram').getByText('src', { exact: true }).first(),
      details: p.getByText(/Problems here and inside/i).locator('xpath=..'),
      deepLink: link(p, 'Deep dive on globe'),
      editor: button(p, /Open in editor/, false),
    }),
  },
  {
    id: 'charts',
    route: '/charts/overview',
    targets: (p) => ({
      tabs: p.getByRole('tablist').first(),
      tabSpeed: p.getByRole('tab', { name: /^Speed/ }),
      tabCode: p.getByRole('tab', { name: /^Code/ }),
      tabAi: p.getByRole('tab', { name: /^AI/ }),
      tabLive: p.getByRole('tab', { name: /^Live/ }),
      tabUsers: p.getByRole('tab', { name: /^Users/ }),
      summary: card(p, 'In simple words'),
      bars: card(p, 'What slows your page the most'),
      pages: p.getByRole('combobox').filter({ hasText: 'All pages' }).first(),
      expert: p.getByText('Expert mode').first(),
      pdf: button(p, 'Export charts (PDF)'),
    }),
  },
  {
    id: 'charts-speed',
    route: '/charts/speed',
    targets: (p) => ({
      filmstrip: card(p, 'What does your visitor see'),
      waterfall: card(p, 'What loads when'),
      tabSpeed: p.getByRole('tab', { name: /^Speed/ }),
    }),
  },
  {
    id: 'charts-code',
    route: '/charts/code',
    // The demo shop loads a tag manager; cover its domain label so no third-party site shows.
    prepare: async (p) => {
      const box = await card(p, 'What takes up space in your code').boundingBox()
      await p.evaluate((b) => {
        const cover = document.createElement('div')
        const bg = getComputedStyle(document.querySelector('section.card')).backgroundColor
        Object.assign(cover.style, {
          position: 'fixed',
          left: `${b.x + b.width - 110}px`,
          top: `${b.y + 130}px`,
          width: '100px',
          height: '24px',
          background: bg,
          zIndex: 10,
        })
        document.body.append(cover)
      }, box)
    },
    targets: (p) => ({
      treemap: card(p, 'What takes up space in your code'),
      unused: card(p, 'How much downloaded code is never used'),
      redraws: card(p, 'Which parts of the screen redraw the most'),
      tabCode: p.getByRole('tab', { name: /^Code/ }),
    }),
  },
  {
    id: 'charts-ai',
    route: '/charts/ai',
    targets: (p) => ({
      glance: card(p, 'AI at a glance'),
      wait: card(p, 'How long do users wait for an AI answer'),
      perRequest: card(p, 'What do you pay for in one AI request'),
      perDay: card(p, 'How much does AI cost per day'),
      tabAi: p.getByRole('tab', { name: /^AI/ }),
    }),
  },
  {
    id: 'charts-live',
    route: '/charts/live',
    targets: (p) => ({
      busy: card(p, 'How busy is your site right now'),
      socket: card(p, 'Is the live connection stable'),
      server: card(p, 'What is your server busy with'),
      memory: card(p, 'Does the app get heavier'),
      tabLive: p.getByRole('tab', { name: /^Live/ }),
    }),
  },
  {
    id: 'charts-users',
    route: '/charts/users',
    targets: (p) => ({
      field: card(p, 'How fast is it for most visitors'),
      countries: card(p, 'Which countries wait the longest'),
      connection: card(p, 'Does the internet connection matter'),
      agents: card(p, 'Can AI assistants use your site'),
    }),
  },
  {
    id: 'compare',
    route: '/compare',
    targets: (p) => ({
      modes: p.getByRole('tablist').first(),
      a: p.getByText('A · Before').locator('xpath=ancestor::*[contains(@class,"card")][1]'),
      b: p.getByText('B · After').locator('xpath=ancestor::*[contains(@class,"card")][1]'),
      testUrl: p.getByRole('tab', { name: 'Test a URL now' }).first(),
      compare: button(p, 'Compare'),
      pageVsPage: p.getByRole('tab', { name: 'Page vs page' }),
    }),
  },
  {
    id: 'live',
    route: '/live',
    targets: (p) => ({
      url: p.locator('main input').first(),
      start: button(p, 'Start'),
      window: p.locator('main select').first(),
      rps: card(p, 'Requests per second'),
      latency: card(p, 'P95 latency'),
      socket: card(p, 'WebSocket messages'),
      roundTrip: card(p, 'WebSocket round-trip'),
      memory: card(p, 'Memory (MB)'),
      slowest: card(p, 'Latest slowest requests'),
    }),
  },
  {
    id: 'settings-ai',
    route: '/settings/ai',
    targets: (p) => ({
      free: card(p, 'Default (free)'),
      local: button(p, 'Use it'),
      providers: card(p, 'Your AI providers'),
      addAi: button(p, '+ Add AI'),
      mcp: card(p, 'AI assistants (MCP)'),
      roles: card(p, 'Which AI does what'),
    }),
  },
  {
    id: 'settings-fix',
    route: '/settings/fix',
    targets: (p) => ({
      how: card(p, 'How fixes are applied'),
      review: p.getByText('Review each change').first(),
      tests: p.getByText('Run tests after each change').first(),
      limits: card(p, 'Limits and targets'),
      protected: p.getByText('Protected folders').first(),
    }),
  },
  {
    id: 'settings-display',
    route: '/settings/display',
    targets: (p) => ({
      theme: card(p, 'Theme and layout'),
      contrast: p.getByText('High contrast').first(),
      defaults: card(p, 'Project defaults'),
      runs: p.getByText('Runs per page').first(),
      editor: p.getByText('Default editor').first(),
      urls: card(p, 'Everything else'),
    }),
  },
]

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const encoder = await browser.newPage()
await page.goto(dashboard)
await page.waitForTimeout(3000)
const only = process.env.ONLY?.split(',')
const HEADER = `// Generated by docs/guides/capture-shots.mjs: where each control sits in each screenshot, in % of the image.
export interface ShotBox {
  x: number
  y: number
  w: number
  h: number
}

export const SHOTS: Record<string, Record<string, ShotBox>> = `
const previous = await readFile(dataFile, 'utf8').catch(() => '')
// The file may have been reformatted by Prettier, so read it as a JS object literal, not JSON.
const shots = previous
  ? new Function(`return ${previous.slice(previous.indexOf('= {') + 2)}`)()
  : {}

for (const shot of SHOTS) {
  if (only && !only.includes(shot.id)) continue
  await go(page, '/guide')
  await page.waitForTimeout(300)
  await go(page, shot.route)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(2500)
  if (shot.prepare) await shot.prepare(page)
  await page.mouse.move(W - 2, H - 2)
  const targets = {}
  for (const [key, target] of Object.entries(shot.targets(page))) {
    const box = await (
      typeof target === 'function' ? target() : target.boundingBox({ timeout: 2000 })
    ).catch(() => null)
    if (!box || box.width < 2 || box.y > H || box.y + box.height < 0) {
      console.warn(`  ${shot.id}.${key}: not on screen, skipped`)
      continue
    }
    const pct = (v, of) => Math.round((v / of) * 1000) / 10
    const top = Math.max(0, box.y)
    targets[key] = {
      x: pct(Math.max(0, box.x), W),
      y: pct(top, H),
      w: pct(box.width, W),
      h: pct(Math.min(H, box.y + box.height) - top, H),
    }
  }
  const png = await page.screenshot({ type: 'png' })
  const webp = await encoder.evaluate(
    async ([b64, q]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      return canvas.toDataURL('image/webp', q).split(',')[1]
    },
    [png.toString('base64'), QUALITY],
  )
  const bytes = Buffer.from(webp, 'base64')
  await writeFile(path.join(outDir, `${shot.id}.webp`), bytes)
  shots[shot.id] = targets
  console.log(
    `${shot.id}.webp ${Math.round(bytes.length / 1024)} KB, ${Object.keys(targets).length} targets`,
  )
}

await writeFile(dataFile, `${HEADER}${JSON.stringify(shots, null, 2)}\n`)
await browser.close()
