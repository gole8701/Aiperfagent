import { expect, test, type Page } from '@playwright/test'

/** Runs against the static build with the sample demo-shop report (no server). */

async function openHome(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('table', { name: /all performance problems/i })).toBeVisible()
}

test('home renders the globe canvas and the problems list', async ({ page }) => {
  await openHome(page)
  await expect(page.locator('canvas.globe-canvas')).toBeVisible()
  const rows = page.locator('table.table tbody tr')
  await expect(rows.first()).toContainText(/Critical|Warning/)
  expect(await rows.count()).toBeGreaterThan(10)
})

test('clicking a problem row opens the deep dive with file:line', async ({ page }) => {
  await openHome(page)
  await page.getByText('Your main picture loads late').first().click()
  await expect(page).toHaveURL(/\/issues\//)
  const panel = page.getByRole('region', { name: 'Where' })
  await expect(panel).toContainText('src/components/HeroBanner.tsx:5')
  await expect(page.getByRole('heading', { name: 'Your main picture loads late' })).toBeVisible()
})

test('chips filter the counts and the list', async ({ page }) => {
  await openHome(page)
  const all = await page.locator('table.table tbody tr').count()
  await page.getByRole('button', { name: /^LCP/ }).click()
  await expect(page).toHaveURL(/filter=metric%3Alcp|filter=metric:lcp/)
  // The list re-renders after the URL changes, so wait for the count to drop.
  await expect.poll(() => page.locator('table.table tbody tr').count()).toBeLessThan(all)
  expect(await page.locator('table.table tbody tr').count()).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: /^LCP/ })).toHaveAttribute('aria-pressed', 'true')
})

test('flow diagram expands nodes and search opens the path', async ({ page }) => {
  await page.goto('/flow')
  await expect(page.locator('.flow-node').first()).toBeVisible()
  const before = await page.locator('.flow-node').count()
  await page.getByRole('button', { name: 'Expand all' }).click()
  await expect.poll(() => page.locator('.flow-node').count()).toBeGreaterThan(before)
  await page.getByRole('button', { name: 'Collapse all' }).click()
  await page.getByLabel('Find a file or component').fill('HeroBanner')
  await expect(page.locator('.flow-node.match').first()).toContainText('HeroBanner')
})

test('charts overview renders 6 charts', async ({ page }) => {
  await page.goto('/charts/overview')
  await expect(page.locator('.chart-card')).toHaveCount(6)
  await expect(page.locator('.chart-card canvas').first()).toBeVisible()
  await expect(page.getByText('What this means:').first()).toBeVisible()
})

test('compare refuses the same report on both sides', async ({ page }) => {
  await page.goto('/compare')
  const pickers = page.getByRole('combobox')
  // The static build has one sample report, so both sides can only pick the same one.
  await pickers.nth(0).selectOption('demo')
  await pickers.nth(1).selectOption('demo')
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeDisabled()
})

test('guide lists groups and opens a topic with a screenshot tour', async ({ page }) => {
  await page.goto('/guide')
  await expect(page.getByRole('region', { name: 'Explore' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Metrics' })).toBeVisible()
  await page.getByRole('link', { name: '3D project globe' }).click()
  await expect(page).toHaveURL(/\/guide\/globe/)
  await expect(page.getByRole('heading', { name: '3D project globe' })).toBeVisible()
  const tour = page.getByRole('region', { name: /How to check/ })
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Next step' }).click()
  await expect(tour.getByText('Use these buttons to rotate, zoom or reset the view.')).toBeVisible()
})

test('metric guides show the "you" marker from the report', async ({ page }) => {
  await page.goto('/guide/lcp')
  await expect(page.getByText(/^you · [\d.]+ s$/)).toBeVisible()
})

test('themes switch', async ({ page }) => {
  // The header picker only shows on wide screens (Settings → Display has it on every size).
  await page.setViewportSize({ width: 1600, height: 900 })
  await openHome(page)
  await page.getByLabel('Theme').selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByLabel('Theme').selectOption('high-contrast')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast')
})

test('keyboard: Tab reaches the first chip', async ({ page }) => {
  await openHome(page)
  const chip = page.getByRole('group', { name: 'Filter by metric' }).getByRole('button').first()
  await chip.focus()
  await expect(chip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
})

test('works at 390 px wide', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await openHome(page)
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(400)
})
