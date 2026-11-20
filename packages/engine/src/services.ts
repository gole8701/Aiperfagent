import type { AiReport, CodeChange, Issue, Report } from '@perfagent/core'

/**
 * Interfaces the server, MCP server and fixer depend on. `@perfagent/ai`
 * implements AiService; the CLI wires implementations in. This keeps the
 * dependency direction one-way and lets tests use stand-ins.
 */
export interface ProviderStatus {
  id: 'ollama' | 'anthropic' | 'openai' | 'openai-compatible' | 'gemini' | 'browser'
  label: string
  free: boolean
  configured: boolean
  /** Key stored (masked) or endpoint set. */
  detail?: string
  models: string[]
  installHint?: string
}

export interface AiUsage {
  monthUsd: number
  calls: number
  lastAt?: string
}

export interface AiContextFile {
  path: string
  text: string
}

export interface ProposedChange extends CodeChange {
  explanation: string
}

export interface ModelComparison {
  provider: ProviderStatus['id']
  model: string
  question: string
  firstTokenMs: number
  totalMs: number
  outputTokens: number
  costUsd: number
  /** 0–1: length sanity for now; thumbs-up ratings can feed in later. */
  qualityScore: number
  answer: string
  error?: string
}

export interface AiService {
  providers(): Promise<ProviderStatus[]>
  testConnection(provider: ProviderStatus['id'], options?: { model?: string; baseUrl?: string }): Promise<{ ok: boolean; message: string; latencyMs: number }>
  storeKey(provider: ProviderStatus['id'], key: string): Promise<void>
  removeKey(provider: ProviderStatus['id']): Promise<void>
  /** Plain-language explanation of one problem using the configured AI. */
  explain(issue: Issue, files: AiContextFile[]): Promise<string>
  /** Proposed code changes for one or more problems. The AI only ever returns text; nothing is applied here. */
  proposeFix(issues: Issue[], files: AiContextFile[], instructions?: string): Promise<ProposedChange[]>
  summarise(report: Report): Promise<string>
  usage(): Promise<AiUsage>
  /** Which free option is active when no key is configured. */
  activeProvider(): Promise<ProviderStatus['id'] | 'rules'>
  /** Aggregates of the AI calls measured by watchAI / the proxy. */
  report(): Promise<AiReport>
  /** Runs the same questions through several configured models with the user's own keys. */
  compareModels(questions: string[], models: { provider: ProviderStatus['id']; model: string }[]): Promise<ModelComparison[]>
}

export type FixScope = { kind: 'issue'; issueIds: string[] } | { kind: 'file'; file: string } | { kind: 'chip'; chip: string } | { kind: 'route'; route: string } | { kind: 'site' }

export interface FixRunRequest {
  reportId: string
  scope: FixScope
  target?: { score?: number; lcp?: number; inp?: number; cls?: number }
  review?: boolean
  /** Stash uncommitted changes before fixing (restored on undo). */
  stashFirst?: boolean
  autoCommit?: boolean
}

export type FixEvent =
  | { type: 'round'; round: number; issueId: string; message: string }
  | { type: 'proposal'; changeId: string; issueId: string; change: ProposedChange }
  | { type: 'applied'; changeId: string; file: string }
  | { type: 'check'; name: string; ok: boolean; output: string }
  | { type: 'retest'; issueId: string; predicted: number; actual: number }
  | { type: 'rolled-back'; changeId: string; reason: string }
  | { type: 'done'; summary: FixSummary }
  | { type: 'error'; message: string }

export interface FixSummary {
  branch: string
  rounds: number
  applied: number
  skipped: number
  rolledBack: number
  costUsd: number
  before: number
  after: number
}

export interface FixRun {
  id: string
  request: FixRunRequest
  branch: string
  status: 'running' | 'waiting-review' | 'done' | 'failed' | 'undone'
  events: FixEvent[]
  pending: { changeId: string; issueId: string; change: ProposedChange }[]
  startedAt: string
}

export interface FixService {
  start(request: FixRunRequest, onEvent: (event: FixEvent) => void): Promise<FixRun>
  get(id: string): FixRun | undefined
  list(): FixRun[]
  accept(id: string, changeIds: string[], edits?: Record<string, string>): Promise<FixRun>
  skip(id: string, changeIds: string[]): Promise<FixRun>
  undo(id: string): Promise<FixRun>
  /** Resolves when the run stops running (done, failed, waiting for review or undone). */
  wait?(id: string): Promise<FixRun>
}
