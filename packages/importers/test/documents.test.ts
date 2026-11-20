import { describe, expect, it } from 'vitest'

import type { ImportResult } from '../src/index.js'

import { importFixture, metric, pageAt } from './helpers.js'

/** Every document fixture carries these /checkout values. */
function expectCheckout(r: ImportResult, confidence: number): void {
  const page = pageAt(r, '/checkout')
  expect(page, 'checkout page').toBeDefined()
  expect(metric(page, 'lcp')).toBeCloseTo(3400, 0)
  expect(metric(page, 'inp')).toBeCloseTo(210, 0)
  expect(metric(page, 'cls')).toBeCloseTo(0.12, 2)
  expect(metric(page, 'ttfb')).toBeCloseTo(820, 0)
  expect(metric(page, 'score')).toBe(72)
  expect(r.report.detected?.length).toBeGreaterThan(0)
  for (const d of r.detected.filter((d) => d.route === '/checkout')) expect(d.confidence, `${d.metric} confidence`).toBeGreaterThanOrEqual(confidence)
  expect(r.report.createdAt).toBe('2026-11-18T00:00:00.000Z')
  expect(r.report.environment.device).toBe('mobile')
}

describe('CSV', () => {
  it('maps header columns to metrics, one page per row', async () => {
    const r = await importFixture('metrics.csv')
    expect(r.format).toBe('csv')
    expectCheckout(r, 0.6)
    expect(r.report.pages.map((p) => p.route)).toEqual(['/checkout', '/', '/product/blue-chair'])
    expect(metric(pageAt(r, '/'), 'lcp')).toBe(1900)
    expect(metric(pageAt(r, '/checkout'), 'jsKb')).toBe(1412)
    expect(metric(pageAt(r, '/checkout'), 'requests')).toBe(48)
    // "Mobile JS (KB)" is a fuzzy header: lower confidence and the whole import is not exact.
    expect(r.detected.find((d) => d.metric === 'jsKb')?.confidence).toBe(0.6)
    expect(r.detected.find((d) => d.metric === 'lcp')?.confidence).toBe(0.9)
    expect(r.exact).toBe(false)
    expect(r.warnings[0]).toMatch(/read with low confidence \(JS\)/)
  })

  it('is exact when every header is a known name', async () => {
    const { importReport } = await import('../src/index.js')
    const r = await importReport({ text: 'page;lcp;cls\n/a;2.1;0.01\n', filename: 'x.csv' })
    expect(r.exact).toBe(true)
    expect(metric(pageAt(r, '/a'), 'lcp')).toBe(2100)
  })
})

describe('PDF', () => {
  it('reads label/value lines with the text detector', async () => {
    const r = await importFixture('report.pdf')
    expect(r.format).toBe('pdf')
    expect(r.exact).toBe(false)
    expectCheckout(r, 0.85)
    expect(r.warnings).toEqual([])
  })
})

describe('Excel', () => {
  it('reads a label/value sheet and a tabular sheet', async () => {
    const r = await importFixture('report.xlsx')
    expect(r.format).toBe('xlsx')
    expect(r.exact).toBe(false)
    expectCheckout(r, 0.85)
    expect(metric(pageAt(r, '/home'), 'lcp')).toBe(1900)
    expect(metric(pageAt(r, '/home'), 'score')).toBe(88)
  })
})

describe('Word', () => {
  it('reads paragraphs and tables', async () => {
    const r = await importFixture('report.docx')
    expect(r.format).toBe('docx')
    expect(r.exact).toBe(false)
    expectCheckout(r, 0.85)
    expect(metric(pageAt(r, '/home'), 'lcp')).toBe(1900)
    expect(metric(pageAt(r, '/home'), 'ttfb')).toBe(410)
  })
})

describe('pasted text', () => {
  it('reads PageSpeed-style lines, routes and a markdown table', async () => {
    const r = await importFixture('pasted.txt')
    expect(r.format).toBe('text')
    expect(r.exact).toBe(false)
    expectCheckout(r, 0.85)
    const checkout = pageAt(r, '/checkout')
    expect(checkout?.url).toBe('https://demo-shop.example/checkout')
    expect(metric(checkout, 'aiFirstTokenMs')).toBe(1200)
    expect(metric(checkout, 'aiCostUsd')).toBeCloseTo(0.011, 3)
    expect(metric(pageAt(r, '/home'), 'lcp')).toBe(1900)
    expect(metric(pageAt(r, '/home'), 'ttfb')).toBe(410)
    expect(metric(pageAt(r, '/product/blue-chair'), 'lcp')).toBe(2600)
    expect(metric(pageAt(r, '/cart'), 'requests')).toBe(29)
    expect(r.report.pages).toHaveLength(4)
  })

  it('rejects text without any metric', async () => {
    const { importReport } = await import('../src/index.js')
    await expect(importReport({ text: 'Hello, nothing to see here.' })).rejects.toMatchObject({ code: 'IMPORT_INVALID' })
  })
})
