import type { LongTask, PageResult, RequestInfo } from '@perfagent/core'

import { lineText, loc, pageMetric, replaceLine, type Finding, type Rule } from '../engine.js'

const docs = {
  lcp: { label: 'web.dev: Optimize LCP', url: 'https://web.dev/articles/optimize-lcp' },
  cls: { label: 'web.dev: Optimize CLS', url: 'https://web.dev/articles/optimize-cls' },
  fonts: { label: 'web.dev: font-display', url: 'https://web.dev/articles/font-best-practices' },
  thirdParty: {
    label: 'web.dev: Third-party JavaScript',
    url: 'https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript',
  },
  caching: {
    label: 'MDN: Cache-Control',
    url: 'https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control',
  },
  coverage: {
    label: 'Chrome: Coverage',
    url: 'https://developer.chrome.com/docs/devtools/coverage',
  },
  imgDims: {
    label: 'web.dev: Set image dimensions',
    url: 'https://web.dev/articles/optimize-cls#images-without-dimensions',
  },
  ttfb: { label: 'web.dev: Optimize TTFB', url: 'https://web.dev/articles/optimize-ttfb' },
  tbt: { label: 'web.dev: Long tasks', url: 'https://web.dev/articles/optimize-long-tasks' },
}

const HERO_HINT = /hero|banner|cover|main|featured|splash|above/i

/** 1. Hero image lazy-loaded → late LCP. */
export const lcpImageLazy: Rule = {
  id: 'general/lcp-image-lazy',
  pack: 'general',
  title: 'Hero image is lazy-loaded',
  plain: 'Your main picture loads late',
  severity: 'critical',
  metrics: ['lcp'],
  areas: ['images'],
  why: 'loading="lazy" tells the browser to wait before downloading the image. For the biggest image on screen that delays the moment the page looks loaded.',
  docs: [docs.lcp],
  steps: [
    'Remove loading="lazy" from the hero image',
    'Add fetchpriority="high" so it downloads first',
    'Preload it in <head> if it is always on the page',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const lcpValue = pageMetric(pages, 'lcp') ?? 3400
    for (const file of scan.files) {
      for (const c of file.components) {
        for (const el of c.elements) {
          if (!['img', 'Image'].includes(el.tag) || el.attributes.loading !== 'lazy') continue
          const src = String(el.attributes.src ?? el.attributes.alt ?? '')
          if (!HERO_HINT.test(src) && !HERO_HINT.test(c.name) && !HERO_HINT.test(file.path))
            continue
          const line = lineText(file, el.line)
          out.push({
            location: loc(file, el.line, c.name),
            chain: {
              metric: 'lcp',
              value: lcpValue,
              element: `img.${c.name.toLowerCase()}`,
              component: { name: c.name, location: loc(file, c.line) },
              code: { snippet: line, location: loc(file, el.line) },
            },
            gain: { from: lcpValue, to: Math.max(1200, lcpValue * 0.55), scoreDelta: 11 },
            changes: [
              replaceLine(
                file,
                el.line,
                line
                  .replace(/\s*loading=["']lazy["']/, '')
                  .replace(/<(img|Image)\b/, '<$1 fetchpriority="high"'),
              ),
            ],
            automatic: true,
            prevent: { metric: 'lcp', max: 2500 },
          })
        }
      }
    }
    return out
  },
}

/** 11. Images without width/height → layout shift. */
export const imageMissingDimensions: Rule = {
  id: 'general/image-missing-dimensions',
  pack: 'general',
  title: 'Image without width and height',
  plain: 'A picture makes the page jump when it appears',
  severity: 'warning',
  metrics: ['cls'],
  areas: ['images', 'rendering'],
  why: 'Without width and height the browser does not reserve space, so content below jumps down when the image arrives.',
  docs: [docs.imgDims, docs.cls],
  steps: ['Add width and height attributes matching the image ratio', 'Or set aspect-ratio in CSS'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const cls = pageMetric(pages, 'cls') ?? 0.18
    for (const file of scan.files) {
      for (const c of file.components) {
        for (const el of c.elements) {
          if (el.tag !== 'img') continue
          const a = el.attributes
          if (
            a.width !== undefined ||
            a.height !== undefined ||
            a.fill !== undefined ||
            /aspect|h-\d|w-\d/.test(String(a.className ?? a.class ?? ''))
          )
            continue
          const line = lineText(file, el.line)
          out.push({
            location: loc(file, el.line, c.name),
            chain: {
              metric: 'cls',
              value: cls,
              element: `<img> in ${c.name}`,
              component: { name: c.name, location: loc(file, c.line) },
              code: { snippet: line, location: loc(file, el.line) },
            },
            gain: { from: cls, to: Math.max(0.02, cls - 0.06), scoreDelta: 4 },
            changes: [
              replaceLine(file, el.line, line.replace(/<img\b/, '<img width={800} height={450}')),
            ],
            steps: [
              'Add width and height matching the real image ratio',
              'Keep CSS max-width: 100% so it still scales',
            ],
            automatic: false,
            confidence: 0.7,
            prevent: { metric: 'cls', max: 0.1 },
          })
        }
      }
    }
    return out
  },
}

/** 8. Fonts without font-display → text jumps / invisible text. */
export const fontDisplayMissing: Rule = {
  id: 'general/font-display-missing',
  pack: 'general',
  title: 'Web font without font-display',
  plain: 'Text jumps or stays invisible while the font loads',
  severity: 'warning',
  metrics: ['cls', 'fcp'],
  areas: ['fonts', 'rendering'],
  why: 'Without font-display the browser may hide text until the custom font arrives, then swap it with a different size, which shifts the layout.',
  docs: [docs.fonts],
  steps: [
    'Add font-display: swap (or optional) to every @font-face',
    'For Google Fonts add &display=swap to the link',
    'Preload the main font file',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const cls = pageMetric(pages, 'cls') ?? 0.15
    for (const asset of scan.assets) {
      const blocks = asset.text.matchAll(/@font-face\s*{[^}]*}/g)
      for (const block of blocks) {
        if (/font-display/.test(block[0])) continue
        const line = asset.text.slice(0, block.index).split('\n').length
        out.push({
          location: { file: asset.path, line },
          chain: {
            metric: 'cls',
            value: cls,
            element: 'text in custom font',
            code: {
              snippet: block[0].split('\n').slice(0, 3).join('\n'),
              location: { file: asset.path, line },
            },
          },
          gain: { from: cls, to: Math.max(0.02, cls - 0.05), scoreDelta: 3 },
          changes: [
            {
              file: asset.path,
              before: block[0].split('\n')[0] ?? '@font-face {',
              after: `${block[0].split('\n')[0] ?? '@font-face {'}\n  font-display: swap;`,
            },
          ],
          automatic: true,
          prevent: { metric: 'cls', max: 0.1 },
        })
      }
      for (const m of asset.text.matchAll(/fonts\.googleapis\.com\/css2?\?[^"'\s)]+/g)) {
        if (m[0].includes('display=')) continue
        const line = asset.text.slice(0, m.index).split('\n').length
        out.push({
          location: { file: asset.path, line },
          chain: {
            metric: 'cls',
            value: cls,
            element: 'Google Fonts stylesheet',
            code: { snippet: m[0], location: { file: asset.path, line } },
          },
          gain: { from: cls, to: Math.max(0.02, cls - 0.05), scoreDelta: 3 },
          changes: [{ file: asset.path, before: m[0], after: `${m[0]}&display=swap` }],
          automatic: true,
        })
      }
    }
    return out
  },
}

/** 6. Third-party script (tag manager, analytics) blocking the main thread. */
export const blockingThirdParty: Rule = {
  id: 'general/blocking-third-party',
  pack: 'general',
  title: 'Third-party script loads synchronously',
  plain: 'An outside script (analytics / tag manager) holds up the page',
  severity: 'critical',
  metrics: ['tbt', 'fcp'],
  areas: ['third-party', 'javascript'],
  why: 'A <script> without async or defer stops HTML parsing until it has downloaded and run. Tag managers then load more scripts on top.',
  docs: [docs.thirdParty],
  steps: [
    'Add async (or defer) to the script tag',
    'Load it after the page is interactive',
    'Review which tags really need to run on every page',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    const tbt = pageMetric(pages, 'tbt') ?? 600
    for (const asset of scan?.assets ?? []) {
      for (const m of asset.text.matchAll(
        /<script\b([^>]*)src=["']([^"']*(googletagmanager|google-analytics|gtag|hotjar|segment|facebook|fbevents|clarity|intercom|hubspot|tiktok)[^"']*)["']([^>]*)>/gi,
      )) {
        const attrs = `${m[1] ?? ''}${m[4] ?? ''}`
        if (/\b(async|defer)\b/.test(attrs)) continue
        const line = asset.text.slice(0, m.index).split('\n').length
        out.push({
          location: { file: asset.path, line },
          chain: {
            metric: 'tbt',
            value: tbt,
            request: fakeRequest(m[2] ?? '', 90_000, true),
            code: { snippet: m[0], location: { file: asset.path, line } },
          },
          gain: { from: tbt, to: Math.max(100, tbt * 0.6), scoreDelta: 8 },
          changes: [
            { file: asset.path, before: m[0], after: m[0].replace('<script', '<script async') },
          ],
          automatic: true,
          prevent: { metric: 'tbt', max: 200 },
        })
      }
    }
    for (const file of scan?.files ?? []) {
      for (const c of file.components) {
        for (const el of c.elements) {
          if (el.tag !== 'script' && el.tag !== 'Script') continue
          const src = String(el.attributes.src ?? '')
          if (!/googletagmanager|gtag|analytics|hotjar|segment|clarity/i.test(src)) continue
          if (
            el.attributes.async !== undefined ||
            el.attributes.defer !== undefined ||
            String(el.attributes.strategy ?? '').includes('lazy') ||
            String(el.attributes.strategy ?? '').includes('afterInteractive')
          )
            continue
          const line = lineText(file, el.line)
          out.push({
            location: loc(file, el.line, c.name),
            chain: {
              metric: 'tbt',
              value: tbt,
              request: fakeRequest(src, 90_000, true),
              component: { name: c.name, location: loc(file, c.line) },
              code: { snippet: line, location: loc(file, el.line) },
            },
            gain: { from: tbt, to: Math.max(100, tbt * 0.6), scoreDelta: 8 },
            changes: [
              replaceLine(
                file,
                el.line,
                line.replace(
                  /<(script|Script)\b/,
                  el.tag === 'Script' ? '<Script strategy="lazyOnload"' : '<script async',
                ),
              ),
            ],
            automatic: true,
            prevent: { metric: 'tbt', max: 200 },
          })
        }
      }
    }
    // Runtime evidence when there is no source: blocking third-party request in the page.
    if (!scan) {
      for (const page of pages) {
        for (const r of page.requests.filter(
          (r) => r.type === 'script' && r.thirdParty && r.blocking,
        )) {
          out.push({
            route: page.route,
            chain: { metric: 'tbt', value: tbt, request: r },
            gain: { from: tbt, to: Math.max(100, tbt * 0.7), scoreDelta: 6 },
            confidence: 0.75,
          })
        }
      }
    }
    return out
  },
}

/** 10. API responses without caching headers. */
export const uncachedApi: Rule = {
  id: 'general/uncached-api',
  pack: 'general',
  title: 'API response is never cached',
  plain: 'The same data is fetched from the server on every visit',
  severity: 'warning',
  metrics: ['ttfb', 'lcp'],
  areas: ['api', 'caching', 'server'],
  why: 'Without Cache-Control every visit waits for the server and database again, even when the data has not changed.',
  docs: [docs.caching, docs.ttfb],
  steps: [
    'Add a Cache-Control header (e.g. s-maxage=60, stale-while-revalidate)',
    'Use the framework’s revalidate option for static data',
    'Keep no-store only for personal data',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const ttfb = pageMetric(pages, 'ttfb') ?? 1100
    for (const file of scan.files) {
      if (!/api|route|server|handler/i.test(file.path)) continue
      for (const fn of file.functions) {
        // Only calls that *send* a response count; `response.json()` on a fetch result is reading.
        const sendsJson = fn.calls.find((c) =>
          /^(res|reply)\.(json|send|end)$|^NextResponse\.json$|^Response\.json$/.test(c.callee),
        )
        if (!sendsJson) continue
        const body = file.text
          .split('\n')
          .slice(fn.line - 1, fn.endLine)
          .join('\n')
        if (/cache-control|revalidate|s-maxage|max-age|no-store/i.test(body)) continue
        out.push({
          location: loc(file, sendsJson.line, fn.name),
          chain: {
            metric: 'ttfb',
            value: ttfb,
            server: { part: `${fn.name}() handler`, ms: Math.round(ttfb * 0.7) },
            code: { snippet: lineText(file, sendsJson.line), location: loc(file, sendsJson.line) },
          },
          gain: { from: ttfb, to: Math.max(200, ttfb * 0.4), scoreDelta: 5 },
          changes: [
            replaceLine(
              file,
              sendsJson.line,
              `res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')\n${lineText(file, sendsJson.line).trim()}`,
            ),
          ],
          automatic: false,
          confidence: 0.7,
          prevent: { metric: 'ttfb', max: 800 },
        })
      }
    }
    return out
  },
}

/** 9. Unused CSS (runtime coverage, or a very large global stylesheet). */
export const unusedCss: Rule = {
  id: 'general/unused-css',
  pack: 'general',
  title: 'Most of a stylesheet is unused',
  plain: 'Styles are downloaded that the page never uses',
  severity: 'warning',
  metrics: ['fcp', 'lcp'],
  areas: ['css', 'unused-code'],
  why: 'Stylesheets block rendering until fully downloaded and parsed. Unused rules make that wait longer for nothing.',
  docs: [docs.coverage],
  steps: [
    'Split the stylesheet per page or component',
    'Enable CSS purging (Tailwind content, PurgeCSS)',
    'Inline the critical CSS and load the rest later',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    const fcp = pageMetric(pages, 'fcp') ?? 2200
    for (const page of pages) {
      for (const c of page.coverage?.filter(
        (c) =>
          /\.css(\?|$)/.test(c.url) && c.totalBytes > 30_000 && c.unusedBytes / c.totalBytes > 0.6,
      ) ?? []) {
        const file = scan?.assets.find((a) => c.url.endsWith(a.path.split('/').pop() ?? '\0'))
        out.push({
          route: page.route,
          location: file ? { file: file.path, line: 1 } : undefined,
          plain: `${Math.round((c.unusedBytes / c.totalBytes) * 100)}% of a stylesheet is never used`,
          chain: {
            metric: 'fcp',
            value: fcp,
            request: fakeRequest(c.url, c.totalBytes, false, 'stylesheet'),
            code: file
              ? { snippet: file.text.split('\n')[0] ?? '', location: { file: file.path, line: 1 } }
              : undefined,
          },
          gain: { from: fcp, to: Math.max(800, fcp * 0.8), scoreDelta: 4 },
          confidence: 0.8,
        })
      }
    }
    if (out.length === 0 && scan) {
      for (const asset of scan.assets.filter(
        (a) => a.path.endsWith('.css') && a.sizeBytes > 120_000,
      )) {
        out.push({
          location: { file: asset.path, line: 1 },
          plain: `A ${Math.round(asset.sizeBytes / 1024)} KB stylesheet is loaded on every page`,
          chain: {
            metric: 'fcp',
            value: fcp,
            request: fakeRequest(asset.path, asset.sizeBytes, false, 'stylesheet'),
            code: {
              snippet: asset.text.split('\n')[0] ?? '',
              location: { file: asset.path, line: 1 },
            },
          },
          gain: { from: fcp, to: Math.max(800, fcp * 0.85), scoreDelta: 3 },
          confidence: 0.6,
        })
      }
    }
    return out
  },
}

/** Runtime-only rules: they work on any URL, with or without source. */
export const slowServer: Rule = {
  id: 'general/slow-ttfb',
  pack: 'general',
  title: 'Server answers slowly',
  plain: 'The server takes too long before it starts sending the page',
  severity: 'warning',
  metrics: ['ttfb'],
  areas: ['server', 'network'],
  why: 'Everything else waits for the first byte. Usually: no caching, slow database queries, cold starts or a far-away server.',
  docs: [docs.ttfb],
  steps: [
    'Cache the HTML or the data it needs',
    'Use a CDN close to your users',
    'Add Server-Timing headers to see which part is slow',
  ],
  detect: ({ pages }) =>
    runtime(pages, 'ttfb', 1800, (v) => ({ to: Math.max(400, v * 0.5), scoreDelta: 5 })),
}

export const heavyMainThread: Rule = {
  id: 'general/long-tasks',
  pack: 'general',
  title: 'Long tasks block the main thread',
  plain: 'Scripts keep the page busy so it cannot react to taps',
  severity: 'critical',
  metrics: ['tbt', 'inp'],
  areas: ['javascript'],
  why: 'Tasks over 50 ms stop the browser from responding to input. The longest tasks here come from the scripts listed in the chain.',
  docs: [docs.tbt],
  steps: [
    'Split long tasks with scheduler.yield() or setTimeout',
    'Move heavy work to a Web Worker',
    'Load third-party scripts later',
  ],
  detect: ({ pages }) => {
    const out: Finding[] = []
    for (const page of pages) {
      const tbt = pageMetric([page], 'tbt')
      if (tbt === undefined || tbt <= 600) continue
      const worst = [...page.longTasks].sort((a, b) => b.durationMs - a.durationMs)[0]
      const scripts = busiestScripts(page.longTasks)
      out.push({
        route: page.route,
        location: worst?.location,
        why: scripts
          ? undefined
          : 'Tasks over 50 ms stop the browser from responding to input. The browser did not say which scripts ran them; record a trace in DevTools to see.',
        chain: {
          metric: 'tbt',
          value: tbt,
          cost: scripts ? { label: 'Busiest scripts', detail: scripts } : undefined,
          code: worst?.location
            ? { snippet: worst.script ?? '', location: worst.location }
            : undefined,
        },
        gain: { from: tbt, to: Math.max(150, tbt * 0.5), scoreDelta: 9 },
        confidence: 0.8,
      })
    }
    return out
  },
}

/** "app.js 420 ms, vendor.js 180 ms" for the three scripts with the most long-task time. */
function busiestScripts(tasks: LongTask[]): string | undefined {
  const total = new Map<string, number>()
  for (const t of tasks)
    if (t.script) total.set(t.script, (total.get(t.script) ?? 0) + t.durationMs)
  const top = [...total].sort((a, b) => b[1] - a[1]).slice(0, 3)
  return top.length
    ? top.map(([script, ms]) => `${shortScript(script)} ${Math.round(ms)} ms`).join(', ')
    : undefined
}

function shortScript(script: string): string {
  const [url = script, fn] = script.split(' ')
  const name = url.split(/[?#]/)[0]?.split('/').filter(Boolean).pop() ?? url
  return fn ? `${name} ${fn}` : name
}

export const tooManyRequests: Rule = {
  id: 'general/too-many-requests',
  pack: 'general',
  title: 'Page loads too many files',
  plain: 'The page downloads a very large number of files',
  severity: 'info',
  metrics: ['lcp', 'fcp'],
  areas: ['network'],
  why: 'Each file costs a round trip. Over HTTP/1.1 only a few download at once; even on HTTP/2 hundreds of files add up.',
  docs: [
    {
      label: 'web.dev: Reduce requests',
      url: 'https://web.dev/articles/reduce-network-payloads-using-text-compression',
    },
  ],
  steps: [
    'Bundle small scripts and styles',
    'Use image sprites or inline tiny SVGs',
    'Remove unused third-party tags',
  ],
  detect: ({ pages }) =>
    runtime(pages, 'requests', 120, (v) => ({ to: Math.round(v * 0.6), scoreDelta: 2 })),
}

export const bigJavaScript: Rule = {
  id: 'general/big-javascript',
  pack: 'general',
  title: 'Too much JavaScript on the page',
  plain: 'The page downloads a lot of code before it can work',
  severity: 'critical',
  metrics: ['tbt', 'lcp'],
  areas: ['bundle', 'javascript'],
  why: 'Every kilobyte of JavaScript must be downloaded, parsed and run on the main thread before the page becomes usable.',
  docs: [
    {
      label: 'web.dev: Reduce JavaScript payloads',
      url: 'https://web.dev/articles/reduce-javascript-payloads-with-code-splitting',
    },
  ],
  steps: [
    'Split code per route (dynamic imports)',
    'Replace heavy libraries',
    'Remove unused code with the coverage tab',
  ],
  detect: ({ pages }) =>
    runtime(pages, 'jsKb', 500, (v) => ({ to: Math.round(v * 0.5), scoreDelta: 8 })),
}

export const uncompressedAssets: Rule = {
  id: 'general/no-compression',
  pack: 'general',
  title: 'Text files served without compression',
  plain: 'Scripts and styles are sent uncompressed',
  severity: 'warning',
  metrics: ['lcp', 'fcp'],
  areas: ['network', 'server'],
  why: 'Brotli or gzip typically shrinks JavaScript and CSS by 70%. Without it every visitor downloads several times more.',
  docs: [
    {
      label: 'web.dev: Text compression',
      url: 'https://web.dev/articles/reduce-network-payloads-using-text-compression',
    },
  ],
  steps: ['Enable Brotli/gzip on the server or CDN', 'Check the Content-Encoding response header'],
  detect: ({ pages }) => {
    const out: Finding[] = []
    for (const page of pages) {
      const big = page.requests.filter(
        (r) =>
          (r.type === 'script' || r.type === 'stylesheet') &&
          r.protocol &&
          !/br|gzip|zstd/.test(r.protocol) &&
          r.transferBytes > 100_000,
      )
      if (big.length === 0) continue
      const lcp = pageMetric([page], 'lcp') ?? 3000
      out.push({
        route: page.route,
        chain: { metric: 'lcp', value: lcp, request: big[0] },
        gain: { from: lcp, to: lcp * 0.8, scoreDelta: 4 },
        confidence: 0.7,
      })
    }
    return out
  },
}

function runtime(
  pages: PageResult[],
  metric: 'ttfb' | 'requests' | 'jsKb' | 'tbt',
  threshold: number,
  gain: (v: number) => { to: number; scoreDelta: number },
): Finding[] {
  const out: Finding[] = []
  for (const page of pages) {
    const value = pageMetric([page], metric)
    if (value === undefined || value <= threshold) continue
    out.push({
      route: page.route,
      chain: { metric, value },
      gain: { from: value, ...gain(value) },
      confidence: 0.8,
    })
  }
  return out
}

function fakeRequest(
  url: string,
  bytes: number,
  thirdParty: boolean,
  type: RequestInfo['type'] = 'script',
): RequestInfo {
  return {
    url,
    type,
    transferBytes: bytes,
    startMs: 0,
    durationMs: 0,
    status: 200,
    thirdParty,
    cached: false,
    blocking: true,
  }
}

export const generalRules: Rule[] = [
  lcpImageLazy,
  imageMissingDimensions,
  fontDisplayMissing,
  blockingThirdParty,
  uncachedApi,
  unusedCss,
  slowServer,
  heavyMainThread,
  tooManyRequests,
  bigJavaScript,
  uncompressedAssets,
]
