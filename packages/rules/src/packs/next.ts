import { lineText, loc, pageMetric, replaceLine, type Finding, type Rule } from '../engine.js'

const docs = {
  image: { label: 'nextjs.org: next/image priority', url: 'https://nextjs.org/docs/app/api-reference/components/image#priority' },
  font: { label: 'nextjs.org: next/font', url: 'https://nextjs.org/docs/app/building-your-application/optimizing/fonts' },
  fetch: { label: 'nextjs.org: fetch caching', url: 'https://nextjs.org/docs/app/building-your-application/data-fetching/fetching' },
  dynamic: { label: 'nextjs.org: next/dynamic', url: 'https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading' },
}

export const nextImagePriority: Rule = {
  id: 'next/image-priority',
  pack: 'next',
  title: 'Above-the-fold next/image without priority',
  plain: 'The main picture is not marked as important',
  severity: 'warning',
  metrics: ['lcp'],
  areas: ['images'],
  why: 'next/image lazy-loads by default. The hero image needs priority so Next preloads it and the browser fetches it first.',
  frameworkRule: 'Next.js: next/image priority',
  docs: [docs.image],
  steps: ['Add priority to the hero <Image>', 'Keep lazy loading for images below the fold'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const lcp = pageMetric(pages, 'lcp') ?? 3200
    for (const file of scan.files) {
      if (!file.imports.some((i) => i.source === 'next/image')) continue
      for (const c of file.components) {
        for (const el of c.elements) {
          if (el.tag !== 'Image' || el.attributes.priority !== undefined || el.attributes.loading === 'lazy') continue
          if (!/hero|banner|cover|featured/i.test(`${String(el.attributes.src ?? '')} ${c.name} ${file.path}`)) continue
          const line = lineText(file, el.line)
          out.push({
            location: loc(file, el.line, c.name),
            chain: { metric: 'lcp', value: lcp, element: 'hero <Image>', component: { name: c.name, location: loc(file, c.line) }, code: { snippet: line, location: loc(file, el.line) } },
            gain: { from: lcp, to: Math.max(1200, lcp * 0.65), scoreDelta: 8 },
            changes: [replaceLine(file, el.line, line.replace('<Image', '<Image priority'))],
            automatic: true,
            prevent: { metric: 'lcp', max: 2500 },
          })
        }
      }
    }
    return out
  },
}

export const nextFontMissing: Rule = {
  id: 'next/font-missing',
  pack: 'next',
  title: 'Google Fonts loaded by <link> instead of next/font',
  plain: 'Fonts are loaded the slow way',
  severity: 'info',
  metrics: ['cls', 'fcp'],
  areas: ['fonts'],
  why: 'next/font self-hosts the font, removes the extra round trip to Google and sets font-display automatically.',
  frameworkRule: 'Next.js: next/font',
  docs: [docs.font],
  steps: ["import { Inter } from 'next/font/google'", 'Apply the returned className to <html> or <body>', 'Remove the <link> tag'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const cls = pageMetric(pages, 'cls') ?? 0.12
    for (const file of scan.files) {
      const m = /fonts\.googleapis\.com/.exec(file.text)
      if (!m) continue
      const line = file.text.slice(0, m.index).split('\n').length
      out.push({ location: loc(file, line), chain: { metric: 'cls', value: cls, request: { url: 'https://fonts.googleapis.com/css2', type: 'stylesheet', transferBytes: 2000, startMs: 0, durationMs: 0, status: 200, thirdParty: true, cached: false }, code: { snippet: lineText(file, line), location: loc(file, line) } }, gain: { from: cls, to: Math.max(0.02, cls - 0.04), scoreDelta: 2 }, confidence: 0.7 })
    }
    return out
  },
}

export const nextFetchNoStore: Rule = {
  id: 'next/fetch-no-store',
  pack: 'next',
  title: 'fetch() with cache: no-store for static data',
  plain: 'Data that rarely changes is fetched fresh on every request',
  severity: 'warning',
  metrics: ['ttfb'],
  areas: ['api', 'caching', 'server'],
  why: "cache: 'no-store' opts the whole route out of caching, so every visitor waits for the upstream API.",
  frameworkRule: 'Next.js: fetch caching',
  docs: [docs.fetch],
  steps: ["Use next: { revalidate: 60 } instead of cache: 'no-store'", 'Keep no-store only for personalised data'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const ttfb = pageMetric(pages, 'ttfb') ?? 1000
    for (const file of scan.files) {
      for (const fn of file.functions) {
        for (const call of fn.calls.filter((c) => c.callee === 'fetch' && /no-store/.test(c.argsText) && !/user|session|cart|account|me\b/i.test(c.argsText))) {
          out.push({
            location: loc(file, call.line, fn.name),
            chain: { metric: 'ttfb', value: ttfb, server: { part: `fetch in ${fn.name}()`, ms: Math.round(ttfb * 0.6) }, code: { snippet: lineText(file, call.line), location: loc(file, call.line) } },
            gain: { from: ttfb, to: Math.max(200, ttfb * 0.5), scoreDelta: 4 },
            changes: [replaceLine(file, call.line, lineText(file, call.line).replace(/cache:\s*['"]no-store['"]/, 'next: { revalidate: 60 }'))],
            automatic: true,
            confidence: 0.7,
          })
        }
      }
    }
    return out
  },
}

export const nextRules: Rule[] = [nextImagePriority, nextFontMissing, nextFetchNoStore]
