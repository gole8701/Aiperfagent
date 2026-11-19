/**
 * The shared vocabulary of PerfAgent. Every package speaks these types; the
 * JSON report (`perfagent-report.json`) is exactly a `Report`.
 */

export type MetricId =
  | 'score'
  | 'lcp'
  | 'inp'
  | 'cls'
  | 'ttfb'
  | 'fcp'
  | 'tbt'
  | 'si'
  | 'jsKb'
  | 'requests'
  | 'transferKb'
  | 'memoryMb'
  | 'wsReconnects'
  | 'wsMessagesPerSec'
  | 'aiFirstTokenMs'
  | 'aiTokensPerSec'
  | 'aiCostUsd'
  | 'aiCacheHitRate'
  | 'aiErrorRate'
  | 'agentReadiness'

export type MetricUnit = 'ms' | 'score' | 'kb' | 'count' | 'ratio' | 'usd' | 'mb' | 'perSec'

export interface MetricValue {
  id: MetricId
  value: number
  unit: MetricUnit
  /** Individual run values when the metric is a median of several runs. */
  samples?: number[]
  /** Real-user 75th percentile when field data is available. */
  p75?: number
  /** Number of real-user samples behind `p75`. */
  sampleCount?: number
}

export type Severity = 'critical' | 'warning' | 'info'

export type Area =
  | 'javascript'
  | 'bundle'
  | 'images'
  | 'fonts'
  | 'css'
  | 'third-party'
  | 'caching'
  | 'api'
  | 'network'
  | 'websocket'
  | 'rendering'
  | 'memory'
  | 'ai'
  | 'hydration'
  | 're-renders'
  | 'code-splitting'
  | 'unused-code'
  | 'server'
  | 'security'
  | 'agents'
  | 'accessibility'

export interface SourceLocation {
  /** Path relative to the project root, POSIX separators. */
  file: string
  line: number
  column?: number
  /** Function, component or element name at that location. */
  symbol?: string
  /** Where the code lived in the shipped bundle, before source maps mapped it back. */
  bundled?: { file: string; line: number; column: number }
}

export type ChainStepKind =
  | 'metric'
  | 'element'
  | 'request'
  | 'component'
  | 'code'
  | 'trace'
  | 'cost'
  | 'server'
  | 'dependency'

export interface ChainStep {
  kind: ChainStepKind
  label: string
  detail?: string
  location?: SourceLocation
}

export interface EstimatedGain {
  metric: MetricId
  from: number
  to: number
  /** Expected change in the 0–100 score when the issue is fixed. */
  scoreDelta: number
  note?: string
}

export interface CodeChange {
  file: string
  before: string
  after: string
}

export interface BuiltInFix {
  steps: string[]
  changes: CodeChange[]
  /** True when the rule engine can apply the change by itself, without AI. */
  automatic: boolean
}

export interface Budget {
  route: string
  metric: MetricId
  max: number
}

export interface DocLink {
  label: string
  url: string
}

export type IssueStatus = 'open' | 'fixed' | 'ignored'

export interface Issue {
  id: string
  ruleId: string
  /** Short technical title, e.g. "Hero image lazy-loaded". */
  title: string
  /** The same thing in plain words, e.g. "Your main picture loads late". */
  plain: string
  severity: Severity
  metrics: MetricId[]
  areas: Area[]
  route?: string
  location?: SourceLocation
  chain: ChainStep[]
  why: string
  /** Name of the framework / library rule that caught it, e.g. "React: memo missing". */
  frameworkRule?: string
  gain: EstimatedGain
  fix: BuiltInFix
  prevent?: Budget
  docs: DocLink[]
  status: IssueStatus
  /** 0–1: how sure the detector is. Below 0.6 the UI says "probable". */
  confidence: number
  /** Measured value after a re-test, filled by the verify step. */
  verified?: { metric: MetricId; predicted: number; actual: number; at: string }
}

export type TreeNodeKind = 'root' | 'dir' | 'file' | 'component' | 'function' | 'element'

export interface TreeNode {
  id: string
  name: string
  kind: TreeNodeKind
  path: string
  line?: number
  /** Short type tag for the UI: DIR, TSX, TS, <>, fn, EL. */
  tag: string
  sizeBytes?: number
  /** Relative paths this file imports; only on file nodes. */
  imports?: string[]
  issueIds: string[]
  /** Problems in this node and everything inside it. */
  counts: { critical: number; warning: number; info: number }
  children: TreeNode[]
}

export interface RequestInfo {
  url: string
  type: 'document' | 'script' | 'stylesheet' | 'image' | 'font' | 'fetch' | 'websocket' | 'other'
  transferBytes: number
  startMs: number
  durationMs: number
  status: number
  thirdParty: boolean
  cached: boolean
  /** Rendering-blocking resource. */
  blocking?: boolean
  protocol?: string
  initiator?: string
}

export interface LongTask {
  startMs: number
  durationMs: number
  script?: string
  location?: SourceLocation
}

export interface LayoutShift {
  value: number
  timeMs: number
  element?: string
}

export interface FilmstripFrame {
  timeMs: number
  /** Data URL (JPEG) or empty when screenshots were not captured. */
  image: string
}

export interface TimelinePhase {
  phase: 'server' | 'download' | 'script' | 'render'
  ms: number
}

export interface PageResult {
  url: string
  route: string
  device: 'mobile' | 'desktop'
  runs: number
  metrics: MetricValue[]
  phases: TimelinePhase[]
  requests: RequestInfo[]
  longTasks: LongTask[]
  layoutShifts: LayoutShift[]
  filmstrip: FilmstripFrame[]
  lcpElement?: string
  /** Browser features present during the scan (soft navigations, LoAF, speculation rules…). */
  features?: Record<string, boolean | number | string>
  /** Unused bytes per script/stylesheet from Chrome coverage. */
  coverage?: { url: string; totalBytes: number; unusedBytes: number }[]
}

export interface AiCallSample {
  at: string
  route?: string
  model: string
  provider: string
  firstTokenMs: number
  totalMs: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  costUsd: number
  error?: string
  retries: number
  stalls: number
  /** Agent steps: LLM calls and tool calls with their durations. */
  steps?: { kind: 'llm' | 'tool' | 'rag'; name: string; ms: number }[]
}

export interface AiReport {
  calls: AiCallSample[]
  /** Call sites found by the static scanner. */
  callSites: SourceLocation[]
  models: { model: string; calls: number; p50FirstTokenMs: number; p95FirstTokenMs: number; costUsd: number; errorRate: number }[]
  budgetUsdPerDay?: number
}

export interface LiveStats {
  windowSeconds: number
  requestsPerSec: number[]
  p95LatencyMs: number[]
  websocket: {
    messagesPerSec: number[]
    bytesPerSec: number[]
    reconnects: { at: string; reason: string }[]
    rttMs: number[]
  }
  peaks: { at: string; metric: string; value: number }[]
  clusters?: { label: string; share: number; reason: string }[]
  memoryMb: number[]
}

export interface BuildInfo {
  commit?: string
  branch?: string
  framework?: string
  frameworkVersion?: string
  dependencies?: Record<string, string>
}

export type EnvironmentMode = 'local' | 'deployed' | 'imported'

export interface Environment {
  name: string
  url?: string
  device: 'mobile' | 'desktop'
  browser: 'chromium' | 'firefox' | 'webkit'
  region?: string
  mode: EnvironmentMode
}

export interface ReadinessReport {
  score: number
  missingLabels: number
  interactiveWithoutName: number
  hasLlmsTxt: boolean
  hasStructuredData: boolean
  pageTokens: number
  notes: string[]
}

export interface Report {
  schemaVersion: 1
  tool: { name: 'perfagent'; version: string }
  id: string
  createdAt: string
  environment: Environment
  build?: BuildInfo
  pages: PageResult[]
  issues: Issue[]
  tree?: TreeNode
  ai?: AiReport
  live?: LiveStats
  readiness?: ReadinessReport
  /** Set by importers that read human documents (PDF, Word, Excel). */
  detected?: DetectedValue[]
  /** Free-form label, e.g. "before deploy" or "v1.5". */
  label?: string
}

export interface DetectedValue {
  metric: MetricId
  value: number
  route?: string
  /** 0–1. Below 0.7 the UI asks the user to check it. */
  confidence: number
  source: string
}

export interface HistoryPoint {
  reportId: string
  at: string
  score: number
  label?: string
  /** Note shown on the trend chart, e.g. "chat widget added". */
  annotation?: string
}
