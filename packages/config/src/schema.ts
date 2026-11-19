import { z } from 'zod'

/**
 * One schema for every option. The same definitions generate the Settings UI
 * and the docs, so a new option is added here and nowhere else.
 */
const metricId = z.enum([
  'score', 'lcp', 'inp', 'cls', 'ttfb', 'fcp', 'tbt', 'si', 'jsKb', 'requests', 'transferKb', 'memoryMb',
  'wsReconnects', 'wsMessagesPerSec', 'aiFirstTokenMs', 'aiTokensPerSec', 'aiCostUsd', 'aiCacheHitRate', 'aiErrorRate', 'agentReadiness',
])

export const editorIds = ['auto', 'vscode', 'cursor', 'windsurf', 'zed', 'sublime', 'jetbrains', 'vim', 'neovim', 'emacs', 'notepad++'] as const
export const aiProviders = ['none', 'ollama', 'anthropic', 'openai', 'openai-compatible', 'gemini', 'browser'] as const
export const themes = ['system', 'dark', 'light', 'high-contrast'] as const

const sizeString = z.string().regex(/^\d+(\.\d+)?\s?(kb|mb)$/i, 'Use a size like "200kb" or "1.5mb"')

export const budgetSchema = z
  .object({
    lcp: z.number().positive().optional().describe('Largest Contentful Paint limit in ms'),
    inp: z.number().positive().optional().describe('Interaction to Next Paint limit in ms'),
    cls: z.number().min(0).optional().describe('Cumulative Layout Shift limit'),
    ttfb: z.number().positive().optional().describe('Time to First Byte limit in ms'),
    tbt: z.number().positive().optional().describe('Total Blocking Time limit in ms'),
    score: z.number().min(0).max(100).optional().describe('Minimum performance score'),
    js: sizeString.optional().describe('Maximum JavaScript per page, e.g. "200kb"'),
    aiFirstTokenMs: z.number().positive().optional().describe('AI first-token p95 limit in ms'),
    aiCacheHitRate: z.number().min(0).max(1).optional().describe('Minimum AI prompt-cache hit rate'),
  })
  .strict()

export const configSchema = z
  .object({
    root: z.string().default('.').describe('Project folder to scan'),
    urls: z.array(z.string().url()).default([]).describe('Pages to measure'),
    device: z.enum(['mobile', 'desktop']).default('mobile').describe('Device profile'),
    browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium').describe('Browser engine for scans'),
    runs: z.number().int().min(1).max(9).default(3).describe('Runs per page; the median is reported'),
    locations: z.array(z.string()).default([]).describe('Regions to test from (hosted feature)'),
    editor: z.enum(editorIds).default('auto').describe('Editor for "Open in editor"'),
    theme: z.enum(themes).default('system').describe('Dashboard theme'),
    language: z.enum(['en', 'hi', 'mr']).default('en').describe('Guide language'),
    rules: z
      .object({
        packs: z.union([z.literal('auto'), z.array(z.string())]).default('auto').describe('Rule packs; "auto" picks from package.json'),
        disable: z.array(z.string()).default([]).describe('Rule ids to switch off'),
      })
      .default({}),
    budgets: z.record(z.string(), budgetSchema).default({}).describe('Per-route limits that fail `perfagent ci`'),
    ai: z
      .object({
        provider: z.enum(aiProviders).default('none').describe('Which AI generates deep fixes'),
        model: z.string().default('').describe('Model name; empty picks the provider default'),
        baseUrl: z.string().url().optional().describe('Custom endpoint (OpenAI-compatible, Azure, company proxy)'),
        sendCode: z.enum(['snippets', 'files', 'none']).default('snippets').describe('How much code may be sent to the AI'),
        monthlyBudgetUsd: z.number().min(0).default(20).describe('Stop using AI past this monthly spend'),
        maxPerFixUsd: z.number().min(0).default(0.2).describe('Stop a single fix past this cost'),
        redact: z.boolean().default(true).describe('Remove secrets before anything is sent'),
        auditLog: z.boolean().default(true).describe('Keep a local log of what was sent to which AI'),
        logPrompts: z.boolean().default(false).describe('Store prompts and answers of measured AI calls'),
        budgetUsdPerDay: z.number().min(0).optional().describe('Budget line on the AI cost chart'),
      })
      .default({}),
    fix: z
      .object({
        review: z.boolean().default(true).describe('Show a diff for Accept / Edit / Skip'),
        autoAccept: z.boolean().default(false).describe('Apply without review (safety checks still run)'),
        runTests: z.boolean().default(true).describe('Run the project tests after each change'),
        testCommand: z.string().optional().describe('Test command; default comes from package.json'),
        autoCommit: z.boolean().default(false).describe('Commit each accepted fix on the fix branch'),
        openPr: z.boolean().default(false).describe('Open a pull request when done (never merges)'),
        maxRounds: z.number().int().min(1).max(50).default(10).describe('Maximum fix → re-test rounds'),
        maxFiles: z.number().int().min(1).default(40).describe('Maximum files changed per run'),
        maxCostUsd: z.number().min(0).default(5).describe('Maximum AI spend per run'),
        protected: z.array(z.string()).default([]).describe('Globs the AI may never edit'),
        target: z.object({ score: z.number().min(0).max(100).optional(), lcp: z.number().optional(), inp: z.number().optional(), cls: z.number().optional() }).default({}),
      })
      .default({}),
    live: z
      .object({
        sampleRate: z.number().min(0).max(1).default(0.1).describe('Share of real-user sessions that report'),
        windowSeconds: z.number().int().min(10).default(60).describe('Live chart window'),
        peakThresholdP95Ms: z.number().positive().default(1500).describe('p95 latency that counts as a peak'),
      })
      .default({}),
    server: z
      .object({
        port: z.number().int().min(1024).max(65535).default(4545),
        open: z.boolean().default(true).describe('Open the browser on start'),
      })
      .default({}),
    scan: z
      .object({
        include: z.array(z.string()).default(['src/**', 'app/**', 'pages/**', 'components/**', 'lib/**', 'server/**']),
        exclude: z.array(z.string()).default(['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**']),
        maxFiles: z.number().int().min(100).default(20_000),
      })
      .default({}),
    environments: z.record(z.string(), z.object({ url: z.string().url() })).default({}),
  })
  .strict()

export type PerfAgentConfig = z.infer<typeof configSchema>
export type PerfAgentConfigInput = z.input<typeof configSchema>
export type BudgetConfig = z.infer<typeof budgetSchema>
export type MetricIdSchema = z.infer<typeof metricId>

export const DEFAULT_CONFIG: PerfAgentConfig = configSchema.parse({})
