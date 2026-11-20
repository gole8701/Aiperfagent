import { describe, expect, it } from 'vitest'

import { importFixture, metric, pageAt } from './helpers.js'

describe('PerfAgent and Lighthouse family', () => {
  it('imports its own report exactly', async () => {
    const r = await importFixture('demo-shop-before.json')
    expect(r.format).toBe('perfagent')
    expect(r.exact).toBe(true)
    expect(metric(r.report.pages[0], 'lcp')).toBe(12396)
  })

  it('imports a Lighthouse 12 report', async () => {
    const r = await importFixture('lighthouse-checkout.json')
    const page = pageAt(r, '/checkout')
    expect(r.format).toBe('lighthouse')
    expect(r.exact).toBe(true)
    expect(metric(page, 'lcp')).toBe(3412.5)
    expect(metric(page, 'fcp')).toBe(1805.2)
    expect(metric(page, 'cls')).toBe(0.121)
    expect(metric(page, 'tbt')).toBe(412)
    expect(metric(page, 'si')).toBe(3980)
    expect(metric(page, 'ttfb')).toBe(820.4)
    expect(metric(page, 'score')).toBe(52)
    expect(metric(page, 'requests')).toBe(10)
    expect(page?.lcpElement).toBe('main > section.hero > img.hero-image')
    expect(page?.requests.find((q) => q.url.includes('googletagmanager'))?.thirdParty).toBe(true)
    expect(r.report.createdAt).toBe('2026-11-18T09:12:44.000Z')
  })

  it('imports a PageSpeed response with field p75 values', async () => {
    const r = await importFixture('psi-home.json')
    const page = pageAt(r, '/')
    expect(r.format).toBe('psi')
    expect(metric(page, 'lcp')).toBe(2610.3)
    expect(page?.metrics.find((m) => m.id === 'lcp')?.p75).toBe(2890)
    expect(page?.metrics.find((m) => m.id === 'cls')?.p75).toBe(0.08)
    expect(metric(page, 'score')).toBe(71)
  })
})

describe('HAR', () => {
  it('builds one page with requests and derived metrics', async () => {
    const r = await importFixture('checkout.har')
    const page = pageAt(r, '/checkout')
    expect(r.format).toBe('har')
    expect(r.exact).toBe(true)
    expect(page?.url.startsWith('https://demo-shop.example/checkout')).toBe(true)
    expect(metric(page, 'ttfb')).toBe(820.4)
    expect(metric(page, 'fcp')).toBe(1805.2)
    expect(metric(page, 'requests')).toBe(10)
    expect(metric(page, 'transferKb')).toBeCloseTo(
      (18420 + 412880 + 141020 + 24210 + 48310 + 98540 + 2210 + 684120 + 210330 + 120) / 1024,
      2,
    )
    expect(metric(page, 'jsKb')).toBeCloseTo((412880 + 141020 + 98540 + 210330) / 1024, 2)
    expect(r.report.createdAt).toBe('2026-11-18T09:12:44.120Z')
    const byUrl = (part: string) => page?.requests.find((q) => q.url.includes(part))
    expect(byUrl('index-Bd3k2.js')).toMatchObject({
      type: 'script',
      transferBytes: 412880,
      startMs: 853,
      durationMs: 1058,
      thirdParty: false,
      blocking: true,
    })
    expect(byUrl('gtm.js')).toMatchObject({ type: 'script', thirdParty: true, cached: false })
    expect(byUrl('fonts.gstatic.com')).toMatchObject({ type: 'font', thirdParty: true })
    expect(byUrl('logo.svg')).toMatchObject({ type: 'image', cached: true, status: 304 })
    expect(byUrl('hero-checkout.jpg')?.blocking).toBeUndefined()
  })
})

describe('Chrome trace', () => {
  it('reads paints, layout shifts, long tasks and requests in one pass', async () => {
    const r = await importFixture('trace-home.json')
    const page = pageAt(r, '/')
    expect(r.format).toBe('trace')
    expect(page?.url).toBe('https://demo-shop.example/')
    expect(metric(page, 'fcp')).toBe(1622.1)
    expect(metric(page, 'lcp')).toBe(2610.3)
    expect(metric(page, 'cls')).toBe(0.052)
    expect(metric(page, 'tbt')).toBe(341)
    expect(metric(page, 'requests')).toBe(4)
    expect(page?.layoutShifts).toHaveLength(2)
    expect(page?.longTasks.map((t) => t.durationMs)).toEqual([120, 180, 261])
    expect(page?.requests.find((q) => q.url.includes('gtm.js'))).toMatchObject({
      type: 'script',
      thirdParty: true,
      transferBytes: 98540,
      status: 200,
    })
  })

  it('accepts a bare event array', async () => {
    const { importReport } = await import('../src/index.js')
    const events = [
      {
        name: 'navigationStart',
        ph: 'R',
        ts: 100,
        args: { data: { documentLoaderURL: 'https://a.example/x' } },
      },
      { name: 'firstContentfulPaint', ph: 'R', ts: 1_500_100, args: {} },
    ]
    const r = await importReport({ text: JSON.stringify(events) })
    expect(r.format).toBe('trace')
    expect(metric(r.report.pages[0], 'fcp')).toBe(1500)
  })
})

describe('bundle stats', () => {
  it('reads webpack stats with large chunk and duplicate package issues', async () => {
    const r = await importFixture('webpack-stats.json')
    const page = r.report.pages[0]
    expect(r.format).toBe('bundle-stats')
    expect(metric(page, 'requests')).toBe(4)
    expect(metric(page, 'jsKb')).toBeCloseTo((318902 + 612344 + 88120) / 1024, 2)
    expect(metric(page, 'transferKb')).toBeCloseTo((318902 + 612344 + 88120 + 41210) / 1024, 2)
    expect(page?.requests.find((q) => q.url.endsWith('.css'))?.type).toBe('stylesheet')
    const large = r.report.issues.filter((i) => i.ruleId === 'bundle/large-chunk').map((i) => i.id)
    expect(large).toEqual([
      'bundle/large-chunk:main.3f2a1c.js',
      'bundle/large-chunk:vendors.7d2e4b.js',
    ])
    const dupes = r.report.issues
      .filter((i) => i.ruleId === 'bundle/duplicate-package')
      .map((i) => i.id)
      .sort()
    expect(dupes).toEqual([
      'bundle/duplicate-package:@scope/ui',
      'bundle/duplicate-package:date-fns',
    ])
    const issue = r.report.issues[0]
    expect(issue).toMatchObject({ status: 'open', confidence: 0.8 })
    expect(issue?.chain.map((c) => c.kind)).toEqual(['metric', 'dependency'])
    expect(issue?.fix.steps.length).toBeGreaterThan(0)
    expect(issue?.docs[0]?.url).toMatch(/^https:/)
  })

  it('reads rollup-plugin-visualizer stats from Vite', async () => {
    const r = await importFixture('vite-stats.json')
    const page = r.report.pages[0]
    expect(r.format).toBe('bundle-stats')
    expect(metric(page, 'requests')).toBe(3)
    expect(page?.requests.find((q) => q.url === 'assets/index-Bd3k2.js')?.transferBytes).toBe(
      2410 + 8120 + 4230 + 132040 + 7220 + 544098 + 61200 + 58900,
    )
    expect(r.report.issues.map((i) => i.id)).toEqual([
      'bundle/large-chunk:assets/index-Bd3k2.js',
      'bundle/duplicate-package:date-fns',
    ])
  })
})

describe('OpenTelemetry', () => {
  it('turns HTTP server spans into route pages and GenAI spans into AI calls', async () => {
    const r = await importFixture('otel-spans.json')
    expect(r.format).toBe('otel')
    expect(metric(pageAt(r, '/checkout'), 'ttfb')).toBe(820)
    expect(pageAt(r, '/checkout')?.metrics.find((m) => m.id === 'ttfb')?.sampleCount).toBe(3)
    expect(metric(pageAt(r, '/'), 'ttfb')).toBe(410)
    const calls = r.report.ai?.calls ?? []
    expect(calls).toHaveLength(3)
    expect(calls[0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      provider: 'anthropic',
      firstTokenMs: 920,
      totalMs: 3400,
      inputTokens: 1200,
      outputTokens: 350,
      cachedTokens: 800,
      route: '/api/assistant',
    })
    expect(calls[0]?.costUsd).toBeCloseTo((1200 * 2 + 350 * 10) / 1e6, 6)
    expect(calls[1]?.firstTokenMs).toBe(1450)
    expect(calls[2]).toMatchObject({
      model: 'claude-haiku-5-5',
      error: 'rate_limit_error: 429',
      firstTokenMs: 310,
    })
    const sonnet = r.report.ai?.models.find((m) => m.model === 'claude-sonnet-5-5')
    expect(sonnet).toMatchObject({
      calls: 2,
      p50FirstTokenMs: 1185,
      p95FirstTokenMs: 1450,
      errorRate: 0,
    })
    expect(r.report.ai?.models.find((m) => m.model === 'claude-haiku-5-5')?.errorRate).toBe(1)
  })

  it('reads Claude Code telemetry metrics', async () => {
    const r = await importFixture('claude-code-metrics.json')
    const calls = r.report.ai?.calls ?? []
    expect(r.format).toBe('otel')
    expect(calls.map((c) => c.provider)).toEqual(['claude-code', 'claude-code'])
    expect(calls[0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      inputTokens: 48210,
      outputTokens: 9120,
      cachedTokens: 312000,
      costUsd: 0.2184,
    })
    expect(r.report.ai?.models.reduce((s, m) => s + m.costUsd, 0)).toBeCloseTo(0.21942, 5)
  })

  it('reads the JS SDK console exporter array', async () => {
    const { importReport } = await import('../src/index.js')
    const spans = [
      {
        traceId: 'abc',
        spanId: '1',
        name: 'chat',
        kind: 3,
        timestamp: 1_763_460_000_000_000,
        duration: 2_000_000,
        attributes: {
          'gen_ai.system': 'openai',
          'gen_ai.request.model': 'gpt-4o-mini',
          'gen_ai.usage.input_tokens': 100,
          'gen_ai.usage.output_tokens': 50,
        },
        status: { code: 0 },
        events: [],
      },
    ]
    const r = await importReport({ text: JSON.stringify(spans) })
    expect(r.format).toBe('otel')
    expect(r.report.ai?.calls[0]).toMatchObject({
      model: 'gpt-4o-mini',
      totalMs: 2000,
      firstTokenMs: 2000,
    })
  })
})

describe('web-vitals export', () => {
  it('groups samples by URL at p75 with sample counts', async () => {
    const r = await importFixture('web-vitals-export.json')
    const checkout = pageAt(r, '/checkout')
    expect(r.format).toBe('web-vitals')
    expect(metric(checkout, 'lcp')).toBe(3412.5)
    expect(metric(checkout, 'inp')).toBe(210)
    expect(metric(checkout, 'cls')).toBe(0.121)
    expect(metric(checkout, 'ttfb')).toBe(820)
    expect(checkout?.metrics.find((m) => m.id === 'lcp')).toMatchObject({
      p75: 3412.5,
      sampleCount: 4,
    })
    expect(metric(pageAt(r, '/'), 'lcp')).toBe(2104.2)
  })
})
