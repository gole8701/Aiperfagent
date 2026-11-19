import { PerfAgentError, type Report } from '@perfagent/core'
import { z } from 'zod'

/** Hard cap on any imported file. Bigger files are rejected before parsing. */
export const MAX_IMPORT_BYTES = 60 * 1024 * 1024

const text = (max = 2000): z.ZodString => z.string().max(max)
const metricId = z.enum([
  'score', 'lcp', 'inp', 'cls', 'ttfb', 'fcp', 'tbt', 'si', 'jsKb', 'requests', 'transferKb', 'memoryMb',
  'wsReconnects', 'wsMessagesPerSec', 'aiFirstTokenMs', 'aiTokensPerSec', 'aiCostUsd', 'aiCacheHitRate', 'aiErrorRate', 'agentReadiness',
])
const area = z.enum([
  'javascript', 'bundle', 'images', 'fonts', 'css', 'third-party', 'caching', 'api', 'network', 'websocket', 'rendering', 'memory', 'ai',
  'hydration', 're-renders', 'code-splitting', 'unused-code', 'server', 'security', 'agents', 'accessibility',
])

const location = z.object({
  file: text(1000),
  line: z.number().int().min(0),
  column: z.number().int().min(0).optional(),
  symbol: text(200).optional(),
  bundled: z.object({ file: text(1000), line: z.number().int(), column: z.number().int() }).optional(),
})

const metricValue = z.object({
  id: metricId,
  value: z.number().finite(),
  unit: z.enum(['ms', 'score', 'kb', 'count', 'ratio', 'usd', 'mb', 'perSec']),
  samples: z.array(z.number().finite()).max(50).optional(),
  p75: z.number().finite().optional(),
  sampleCount: z.number().int().min(0).optional(),
})

const chainStep = z.object({
  kind: z.enum(['metric', 'element', 'request', 'component', 'code', 'trace', 'cost', 'server', 'dependency']),
  label: text(500),
  detail: text(4000).optional(),
  location: location.optional(),
})

const issue = z.object({
  id: text(300),
  ruleId: text(100),
  title: text(200),
  plain: text(300),
  severity: z.enum(['critical', 'warning', 'info']),
  metrics: z.array(metricId).max(10),
  areas: z.array(area).max(10),
  route: text(500).optional(),
  location: location.optional(),
  chain: z.array(chainStep).max(20),
  why: text(2000),
  frameworkRule: text(200).optional(),
  gain: z.object({ metric: metricId, from: z.number().finite(), to: z.number().finite(), scoreDelta: z.number().finite(), note: text(300).optional() }),
  fix: z.object({
    steps: z.array(text(1000)).max(20),
    changes: z.array(z.object({ file: text(1000), before: text(20_000), after: text(20_000) })).max(20),
    automatic: z.boolean(),
  }),
  prevent: z.object({ route: text(500), metric: metricId, max: z.number().finite() }).optional(),
  docs: z.array(z.object({ label: text(200), url: z.string().url().max(1000) })).max(10),
  status: z.enum(['open', 'fixed', 'ignored']),
  confidence: z.number().min(0).max(1),
  verified: z.object({ metric: metricId, predicted: z.number(), actual: z.number(), at: text(50) }).optional(),
})

const treeNode: z.ZodType<Report['tree']> = z.lazy(() =>
  z.object({
    id: text(1200),
    name: text(300),
    kind: z.enum(['root', 'dir', 'file', 'component', 'function', 'element']),
    path: text(1000),
    line: z.number().int().optional(),
    tag: text(10),
    sizeBytes: z.number().int().min(0).optional(),
    imports: z.array(text(1000)).optional(),
    issueIds: z.array(text(300)),
    counts: z.object({ critical: z.number().int(), warning: z.number().int(), info: z.number().int() }),
    children: z.array(treeNode),
  }),
) as z.ZodType<Report['tree']>

const request = z.object({
  url: text(2000),
  type: z.enum(['document', 'script', 'stylesheet', 'image', 'font', 'fetch', 'websocket', 'other']),
  transferBytes: z.number().min(0),
  startMs: z.number().min(0),
  durationMs: z.number().min(0),
  status: z.number().int(),
  thirdParty: z.boolean(),
  cached: z.boolean(),
  blocking: z.boolean().optional(),
  protocol: text(20).optional(),
  initiator: text(500).optional(),
})

const page = z.object({
  url: text(2000),
  route: text(500),
  device: z.enum(['mobile', 'desktop']),
  runs: z.number().int().min(1),
  metrics: z.array(metricValue).max(40),
  phases: z.array(z.object({ phase: z.enum(['server', 'download', 'script', 'render']), ms: z.number().min(0) })).max(4),
  requests: z.array(request).max(5000),
  longTasks: z.array(z.object({ startMs: z.number(), durationMs: z.number(), script: text(1000).optional(), location: location.optional() })).max(2000),
  layoutShifts: z.array(z.object({ value: z.number(), timeMs: z.number(), element: text(500).optional() })).max(2000),
  filmstrip: z.array(z.object({ timeMs: z.number(), image: z.string().max(400_000) })).max(30),
  lcpElement: text(500).optional(),
  features: z.record(z.string().max(100), z.union([z.boolean(), z.number(), z.string().max(200)])).optional(),
  coverage: z.array(z.object({ url: text(2000), totalBytes: z.number(), unusedBytes: z.number() })).max(2000).optional(),
})

const aiCall = z.object({
  at: text(50),
  route: text(500).optional(),
  model: text(100),
  provider: text(50),
  firstTokenMs: z.number().min(0),
  totalMs: z.number().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cachedTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  error: text(300).optional(),
  retries: z.number().int().min(0),
  stalls: z.number().int().min(0),
  steps: z.array(z.object({ kind: z.enum(['llm', 'tool', 'rag']), name: text(200), ms: z.number().min(0) })).max(500).optional(),
})

export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  tool: z.object({ name: z.literal('perfagent'), version: text(50) }),
  id: text(100),
  createdAt: text(50),
  environment: z.object({
    name: text(100),
    url: text(2000).optional(),
    device: z.enum(['mobile', 'desktop']),
    browser: z.enum(['chromium', 'firefox', 'webkit']),
    region: text(100).optional(),
    mode: z.enum(['local', 'deployed', 'imported']),
  }),
  build: z
    .object({
      commit: text(64).optional(),
      branch: text(200).optional(),
      framework: text(100).optional(),
      frameworkVersion: text(50).optional(),
      dependencies: z.record(z.string().max(200), z.string().max(100)).optional(),
    })
    .optional(),
  pages: z.array(page).max(200),
  issues: z.array(issue).max(5000),
  tree: treeNode.optional(),
  ai: z
    .object({
      calls: z.array(aiCall).max(20_000),
      callSites: z.array(location).max(2000),
      models: z.array(z.object({ model: text(100), calls: z.number().int(), p50FirstTokenMs: z.number(), p95FirstTokenMs: z.number(), costUsd: z.number(), errorRate: z.number() })).max(100),
      budgetUsdPerDay: z.number().min(0).optional(),
    })
    .optional(),
  live: z
    .object({
      windowSeconds: z.number().int(),
      requestsPerSec: z.array(z.number()).max(10_000),
      p95LatencyMs: z.array(z.number()).max(10_000),
      websocket: z.object({
        messagesPerSec: z.array(z.number()).max(10_000),
        bytesPerSec: z.array(z.number()).max(10_000),
        reconnects: z.array(z.object({ at: text(50), reason: text(300) })).max(5000),
        rttMs: z.array(z.number()).max(10_000),
      }),
      peaks: z.array(z.object({ at: text(50), metric: text(100), value: z.number() })).max(5000),
      clusters: z.array(z.object({ label: text(300), share: z.number(), reason: text(500) })).max(100).optional(),
      memoryMb: z.array(z.number()).max(10_000),
    })
    .optional(),
  readiness: z
    .object({
      score: z.number(),
      missingLabels: z.number().int(),
      interactiveWithoutName: z.number().int(),
      hasLlmsTxt: z.boolean(),
      hasStructuredData: z.boolean(),
      pageTokens: z.number().int(),
      notes: z.array(text(500)).max(50),
    })
    .optional(),
  detected: z.array(z.object({ metric: metricId, value: z.number(), route: text(500).optional(), confidence: z.number().min(0).max(1), source: text(300) })).max(500).optional(),
  label: text(200).optional(),
})

export type ReportSchema = z.infer<typeof reportSchema>

/** Validates untrusted JSON. Throws a PerfAgentError with a plain message on failure. */
export function parseReport(data: unknown): Report {
  const result = reportSchema.safeParse(data)
  if (!result.success) {
    const first = result.error.issues[0]
    const where = first ? `${first.path.join('.') || 'root'}: ${first.message}` : 'unknown field'
    throw new PerfAgentError('IMPORT_INVALID', `This is not a valid PerfAgent report (${where}).`, 'Export it again from PerfAgent, or import it as Lighthouse / HAR / text instead.')
  }
  return result.data as Report
}

export function isReportLike(data: unknown): data is { schemaVersion: number; tool: { name: string } } {
  return typeof data === 'object' && data !== null && 'schemaVersion' in data && 'tool' in data
}
