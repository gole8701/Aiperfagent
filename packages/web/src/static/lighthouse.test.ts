import { describe, expect, it } from 'vitest'

import { convertLighthouse, isLighthouseJson, type Lighthouse } from './lighthouse'

const lhr: Lighthouse = {
  lighthouseVersion: '12.0.0',
  requestedUrl: 'https://example.com/shop',
  finalDisplayedUrl: 'https://example.com/shop',
  fetchTime: '2026-11-20T10:00:00.000Z',
  configSettings: { formFactor: 'mobile' },
  categories: { performance: { score: 0.61 } },
  audits: {
    'largest-contentful-paint': { id: 'largest-contentful-paint', title: 'LCP', score: 0.3, numericValue: 4200 },
    'first-contentful-paint': { id: 'first-contentful-paint', title: 'FCP', score: 0.7, numericValue: 1900 },
    'server-response-time': { id: 'server-response-time', title: 'TTFB', score: 0.9, numericValue: 600 },
    'total-blocking-time': { id: 'total-blocking-time', title: 'TBT', score: 0.5, numericValue: 450 },
    'cumulative-layout-shift': { id: 'cumulative-layout-shift', title: 'CLS', score: 0.9, numericValue: 0.05 },
    'network-requests': {
      id: 'network-requests',
      title: 'Network',
      score: null,
      details: {
        items: [
          { url: 'https://example.com/shop', resourceType: 'Document', transferSize: 12_000, networkRequestTime: 0, networkEndTime: 600, statusCode: 200 },
          { url: 'https://example.com/app.js', resourceType: 'Script', transferSize: 300_000, networkRequestTime: 700, networkEndTime: 2100, statusCode: 200 },
          { url: 'https://cdn.tagmanager.test/gtm.js', resourceType: 'Script', transferSize: 90_000, networkRequestTime: 800, networkEndTime: 1500, statusCode: 200 },
        ],
      },
    },
    'uses-responsive-images': { id: 'uses-responsive-images', title: 'Properly size images', description: 'Serve images that are appropriately-sized. [Learn more](https://web.dev/uses-responsive-images/).', score: 0.4, metricSavings: { LCP: 900 }, details: { type: 'opportunity', overallSavingsMs: 900, items: [{ url: 'https://example.com/hero.png' }] } },
    'screenshot-thumbnails': { id: 'screenshot-thumbnails', title: 'Filmstrip', score: null, details: { items: [{ timing: 500, data: 'data:image/jpeg;base64,AAA' }, { timing: 1000, data: 'data:image/jpeg;base64,BBB' }] } },
  },
}

describe('convertLighthouse', () => {
  it('recognises plain and PageSpeed-wrapped results', () => {
    expect(isLighthouseJson(lhr)).toBe(true)
    expect(isLighthouseJson({ lighthouseResult: lhr })).toBe(true)
    expect(isLighthouseJson({ schemaVersion: 1 })).toBe(false)
  })

  it('maps metrics, requests, filmstrip and failing audits onto a Report', () => {
    const report = convertLighthouse({ lighthouseResult: lhr })
    const page = report.pages[0]
    expect(page?.route).toBe('/shop')
    expect(page?.metrics.find((m) => m.id === 'lcp')?.value).toBe(4200)
    expect(page?.metrics.find((m) => m.id === 'score')?.value).toBe(61)
    expect(page?.metrics.find((m) => m.id === 'jsKb')?.value).toBeCloseTo(390_000 / 1024, 1)
    expect(page?.requests).toHaveLength(3)
    expect(page?.requests.find((r) => r.url.includes('tagmanager'))?.thirdParty).toBe(true)
    expect(page?.filmstrip).toHaveLength(2)
    expect(page?.phases.find((p) => p.phase === 'server')?.ms).toBe(600)
    const issue = report.issues.find((i) => i.ruleId === 'lighthouse/uses-responsive-images')
    expect(issue?.severity).toBe('critical')
    expect(issue?.gain.metric).toBe('lcp')
    expect(issue?.gain.scoreDelta).toBe(3)
    expect(issue?.why).not.toContain('[Learn more]')
    expect(issue?.docs[0]?.url).toBe('https://web.dev/uses-responsive-images/')
    expect(report.environment.mode).toBe('imported')
  })
})
