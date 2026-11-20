import type { Comparison, DetectedValue, HistoryPoint, Issue, LiveStats, Report } from '@perfagent/core'

export type Mode = 'local' | 'deployed' | 'imported' | 'static'

export interface Status {
  version: string
  mode: Mode
  modeReasons: string[]
  project: { root: string; name?: string; framework?: string; frameworkVersion?: string; commit?: string; branch?: string }
  config: { urls: string[]; device: string; runs: number; editor: string; theme: string; language: string; aiProvider: string; environments: Record<string, { url: string }> }
  editors: Record<string, string>
  latestReportId?: string
  capabilities: { scanProject: boolean; openEditor: boolean; applyFixes: boolean; ai: boolean; live: boolean }
  options: OptionDoc[]
}

export interface OptionDoc {
  path: string
  type: string
  default: unknown
  description: string
  choices?: string[]
}

export interface SettingsResponse {
  config: Record<string, unknown>
  schema: OptionDoc[]
}

export interface Job {
  id: string
  kind: string
  status: 'queued' | 'running' | 'done' | 'failed'
  progress: { phase: string; message: string; fraction: number }
  error?: string
  reportId?: string
}

export interface ImportResult {
  reportId: string
  format: string
  exact: boolean
  detected?: DetectedValue[]
  warnings: string[]
  report: Report
}

export type CompareSource = { kind: 'report'; reportId: string } | { kind: 'url'; url: string } | { kind: 'text'; text: string; filename?: string } | { kind: 'link'; url: string }

export interface CompareResponse {
  comparison: Comparison
  extra: Comparison[]
  reports: { id: string; label: string; createdAt: string; pages: string[] }[]
}

export interface ProviderStatus {
  id: 'ollama' | 'anthropic' | 'openai' | 'openai-compatible' | 'gemini' | 'browser'
  label: string
  free: boolean
  configured: boolean
  detail?: string
  models: string[]
  installHint?: string
}

export interface ProvidersResponse {
  providers: ProviderStatus[]
  active: ProviderStatus['id'] | 'rules'
  usage: { monthUsd: number; calls: number; lastAt?: string }
  config: Record<string, unknown>
}

export interface McpConfig {
  label: string
  file: string
  snippet: string
}

export interface ProposedChange {
  file: string
  before: string
  after: string
  explanation: string
}

export type FixScope = { kind: 'issue'; issueIds: string[] } | { kind: 'file'; file: string } | { kind: 'chip'; chip: string } | { kind: 'route'; route: string } | { kind: 'site' }

export type FixEvent =
  | { type: 'round'; round: number; issueId: string; message: string }
  | { type: 'proposal'; changeId: string; issueId: string; change: ProposedChange }
  | { type: 'applied'; changeId: string; file: string }
  | { type: 'check'; name: string; ok: boolean; output: string }
  | { type: 'retest'; issueId: string; predicted: number; actual: number }
  | { type: 'rolled-back'; changeId: string; reason: string }
  | { type: 'done'; summary: { branch: string; rounds: number; applied: number; skipped: number; rolledBack: number; costUsd: number; before: number; after: number } }
  | { type: 'error'; message: string }

export interface FixRun {
  id: string
  branch: string
  status: 'running' | 'waiting-review' | 'done' | 'failed' | 'undone'
  events: FixEvent[]
  pending: { changeId: string; issueId: string; change: ProposedChange }[]
  startedAt: string
}

export interface LiveTick {
  at: string
  requestsPerSec: number
  p95LatencyMs: number
  wsMessagesPerSec: number
  wsBytesPerSec: number
  wsReconnects: number
  wsRttMs: number
  memoryMb: number
  slowest: { url: string; ms: number }[]
  peak?: { metric: string; value: number }
}

export interface LiveStopResponse {
  stopped: boolean
  reportId?: string
  stats?: LiveStats
}

export interface GuideMeta {
  topic: string
  title: string
  group: string
  summary: string
  order: number
  tryIt?: string
  metric?: string
}

export interface GuideDoc extends GuideMeta {
  body: string
}

export interface EditorOpenResult {
  opened: boolean
  absolute?: string
  fallbackUrl?: string
  message: string
  hint?: string
}

export interface Snippet {
  file: string
  startLine: number
  lines: string[]
  totalLines: number
}

export type ScanList = HistoryPoint[]

export interface IssuesResponse { reportId?: string; issues: Issue[]; chips: { metrics: Record<string, number>; areas: Record<string, number>; total: number } }
