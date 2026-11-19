/** Programmatic API of the `perfagent` package. */
export { defineConfig } from '@perfagent/config'
export type { PerfAgentConfig, PerfAgentConfigInput } from '@perfagent/config'
export { runScan, retestIssue, ReportStore, checkBudgets } from '@perfagent/engine'
export type { ScanRequest, ScanProgress } from '@perfagent/engine'
export { compareReports, summarise, METRICS, AREAS } from '@perfagent/core'
export type { Report, Issue, PageResult, TreeNode, MetricId, Area } from '@perfagent/core'
export { importReport } from '@perfagent/importers'
export { createServer } from '@perfagent/server'
