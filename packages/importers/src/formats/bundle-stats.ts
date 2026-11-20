import { buildRootCauseChain, type Issue, type RequestInfo } from '@perfagent/core'

import { emptyReport, pageFromMetrics } from '../report-builder.js'
import type { Importer } from '../types.js'

/** Normalised view of webpack stats, rollup-plugin-visualizer JSON, Vite manifests and Next.js build manifests. */
interface Bundle {
  tool: string
  assets: { name: string; bytes: number }[]
  modules: { path: string; bytes: number }[]
}

interface WebpackStats {
  assets?: { name?: string; size?: number }[]
  chunks?: { id?: string | number; names?: string[]; files?: string[]; size?: number }[]
  modules?: { name?: string; identifier?: string; size?: number }[]
}
interface VisualizerNode {
  name?: string
  uid?: string
  children?: VisualizerNode[]
}
interface VisualizerStats {
  tree: VisualizerNode
  nodeParts?: Record<string, { renderedLength?: number }>
  nodeMetas?: Record<string, { id?: string }>
}

const LARGE_CHUNK_BYTES = 250 * 1024
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function fromWebpack(stats: WebpackStats): Bundle {
  const chunks = (stats.chunks ?? []).map((c) => ({
    name: c.names?.[0] ?? c.files?.[0] ?? String(c.id ?? 'chunk'),
    bytes: c.size ?? 0,
  }))
  const assets = (stats.assets ?? [])
    .filter((a) => /\.(m?js|css)$/.test(a.name ?? ''))
    .map((a) => ({ name: a.name ?? '', bytes: a.size ?? 0 }))
  return {
    tool: 'webpack',
    assets: assets.length ? assets : chunks,
    modules: (stats.modules ?? []).map((m) => ({
      path: m.name ?? m.identifier ?? '',
      bytes: m.size ?? 0,
    })),
  }
}

function fromVisualizer(stats: VisualizerStats): Bundle {
  const modules: Bundle['modules'] = []
  const sizeOf = (node: VisualizerNode, depth: number): number => {
    if (node.uid !== undefined && !node.children) {
      const bytes = stats.nodeParts?.[node.uid]?.renderedLength ?? 0
      modules.push({ path: stats.nodeMetas?.[node.uid]?.id ?? node.name ?? '', bytes })
      return bytes
    }
    return depth > 60 ? 0 : (node.children ?? []).reduce((s, c) => s + sizeOf(c, depth + 1), 0)
  }
  const assets = (stats.tree.children ?? []).map((chunk) => ({
    name: chunk.name ?? 'chunk',
    bytes: sizeOf(chunk, 0),
  }))
  return { tool: 'vite', assets, modules }
}

function fromManifest(json: Record<string, unknown>): Bundle {
  const files = new Set<string>()
  const pages = isObject(json.pages) ? json.pages : json
  for (const entry of Object.values(pages)) {
    if (Array.isArray(entry)) entry.forEach((f) => typeof f === 'string' && files.add(f))
    else if (isObject(entry)) {
      if (typeof entry.file === 'string') files.add(entry.file)
      if (Array.isArray(entry.css)) entry.css.forEach((f) => typeof f === 'string' && files.add(f))
    }
  }
  return {
    tool: isObject(json.pages) ? 'next' : 'vite-manifest',
    assets: [...files].map((name) => ({ name, bytes: 0 })),
    modules: [],
  }
}

function toBundle(json: unknown): Bundle | undefined {
  if (!isObject(json)) return undefined
  if (Array.isArray(json.assets) || Array.isArray(json.chunks))
    return fromWebpack(json as WebpackStats)
  if (isObject(json.tree) && (isObject(json.nodeParts) || isObject(json.nodeMetas)))
    return fromVisualizer(json as unknown as VisualizerStats)
  if (isObject(json.pages) && Object.values(json.pages).every(Array.isArray))
    return fromManifest(json)
  const values = Object.values(json)
  if (values.length && values.every((v) => isObject(v) && typeof v.file === 'string'))
    return fromManifest(json)
  return undefined
}

export const bundleStatsImporter: Importer = {
  format: 'bundle-stats',
  matches: (_input, json) => toBundle(json) !== undefined,
  run: (input, json) => {
    const bundle = toBundle(json) ?? { tool: 'bundle', assets: [], modules: [] }
    const requests: RequestInfo[] = bundle.assets.slice(0, 5000).map((a) => ({
      url: a.name,
      type: a.name.endsWith('.css') ? 'stylesheet' : 'script',
      transferBytes: a.bytes,
      startMs: 0,
      durationMs: 0,
      status: 200,
      thirdParty: false,
      cached: false,
    }))
    const jsBytes = requests
      .filter((r) => r.type === 'script')
      .reduce((s, r) => s + r.transferBytes, 0)
    const totalBytes = requests.reduce((s, r) => s + r.transferBytes, 0)
    const page = pageFromMetrics(
      '/',
      { jsKb: jsBytes / 1024, transferKb: totalBytes / 1024, requests: requests.length },
      'mobile',
      requests,
    )
    const issues = [
      ...largeChunkIssues(bundle, jsBytes / 1024),
      ...duplicatePackageIssues(bundle, jsBytes / 1024),
    ]
    const report = emptyReport(input.filename ?? 'Bundle stats', {
      environment: { name: bundle.tool, device: 'mobile', browser: 'chromium', mode: 'imported' },
      pages: [page],
      issues,
    })
    return Promise.resolve({
      format: 'bundle-stats',
      report,
      detected: [],
      warnings: [],
      exact: true,
    })
  },
}

function issue(
  ruleId: string,
  name: string,
  title: string,
  plain: string,
  why: string,
  sizeKb: number,
  jsKb: number,
  steps: string[],
  docs: Issue['docs'],
): Issue {
  const savedKb = Math.round(sizeKb / 2)
  return {
    id: `${ruleId}:${name}`,
    ruleId,
    title,
    plain,
    severity: sizeKb > 500 ? 'critical' : 'warning',
    metrics: ['jsKb', 'tbt'],
    areas: ['bundle', 'code-splitting'],
    route: '/',
    chain: buildRootCauseChain({
      metric: 'jsKb',
      value: jsKb,
      dependency: { name, sizeKb: Math.round(sizeKb) },
    }),
    why,
    gain: {
      metric: 'jsKb',
      from: Math.round(jsKb),
      to: Math.round(jsKb - savedKb),
      scoreDelta: Math.min(10, Math.round(savedKb / 100)),
      note: 'Estimate: about half of this size can usually be deferred or removed.',
    },
    fix: { steps, changes: [], automatic: false },
    docs,
    status: 'open',
    confidence: 0.8,
  }
}

function largeChunkIssues(bundle: Bundle, jsKb: number): Issue[] {
  return bundle.assets
    .filter((a) => a.bytes > LARGE_CHUNK_BYTES)
    .slice(0, 50)
    .map((a) => {
      const kb = a.bytes / 1024
      return issue(
        'bundle/large-chunk',
        a.name,
        `Large chunk: ${a.name} (${Math.round(kb)} KB)`,
        'One of your code files is very big',
        `Chunks over 250 KB take long to download and parse on phones. ${a.name} is ${Math.round(kb)} KB.`,
        kb,
        jsKb,
        [
          'Split the chunk with dynamic import() at route or feature boundaries.',
          'Check the biggest packages inside it and replace or lazy-load them.',
          'Make sure the build minifies and tree-shakes the chunk.',
        ],
        [
          {
            label: 'Code splitting',
            url: 'https://web.dev/articles/reduce-javascript-payloads-with-code-splitting',
          },
        ],
      )
    })
}

/** Same package name under different node_modules paths means it ships twice. */
function duplicatePackageIssues(bundle: Bundle, jsKb: number): Issue[] {
  const byName = new Map<string, Map<string, number>>()
  for (const m of bundle.modules) {
    const parts = m.path.split(/node_modules\//)
    if (parts.length < 2) continue
    const last = parts[parts.length - 1] ?? ''
    const name = /^(@[^/]+\/[^/]+|[^/]+)/.exec(last)?.[1]
    if (!name) continue
    const prefix = parts.slice(0, -1).join('node_modules/')
    const copies = byName.get(name) ?? new Map<string, number>()
    copies.set(prefix, (copies.get(prefix) ?? 0) + m.bytes)
    byName.set(name, copies)
  }
  return [...byName]
    .filter(([, copies]) => copies.size > 1)
    .slice(0, 50)
    .map(([name, copies]) => {
      const kb =
        [...copies.values()]
          .sort((a, b) => a - b)
          .slice(0, -1)
          .reduce((s, b) => s + b, 0) / 1024
      return issue(
        'bundle/duplicate-package',
        name,
        `Duplicate package: ${name} (${copies.size} copies)`,
        'The same library is included more than once',
        `${name} is bundled ${copies.size} times from different node_modules folders, so users download it ${copies.size} times.`,
        Math.max(kb, 1),
        jsKb,
        [
          `Run your package manager's dedupe (npm dedupe / pnpm dedupe / yarn-deduplicate).`,
          `Align the version of ${name} that your dependencies ask for.`,
          'Add a resolution/override if one dependency pins an old version.',
        ],
        [
          {
            label: 'Remove duplicate packages',
            url: 'https://web.dev/articles/commonjs-larger-bundles',
          },
        ],
      )
    })
}
