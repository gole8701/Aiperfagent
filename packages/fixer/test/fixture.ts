import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { configSchema, type PerfAgentConfig } from '@perfagent/config'
import type { Issue, Report } from '@perfagent/core'
import { ReportStore, git, type AiService, type FixRunRequest, type ProposedChange } from '@perfagent/engine'

const run = promisify(execFile)
const here = path.dirname(fileURLToPath(import.meta.url))
const demoShop = path.resolve(here, '../../../fixtures/demo-shop')
const reportFile = path.resolve(here, '../../../fixtures/reports/demo-shop-before.json')

export interface Repo {
  root: string
  config: PerfAgentConfig
  store: ReportStore
  report: Report
  /** The seeded automatic issue (HeroBanner lazy image). */
  heroIssue: Issue
  /** A non-automatic issue pointing at src/a.ts for AI-driven changes. */
  aiIssue: Issue
  gitLog: string[][]
  git: typeof git
}

/** A throw-away git repo on `main` with a passing (or failing) `test` script. */
export async function makeRepo(options: { testPasses?: boolean; configOverrides?: Record<string, unknown> } = {}): Promise<Repo> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'perfagent-fixer-'))
  await mkdir(path.join(root, 'src', 'components'), { recursive: true })
  await mkdir(path.join(root, 'src', 'payments'), { recursive: true })
  await cp(path.join(demoShop, 'src', 'components', 'HeroBanner.tsx'), path.join(root, 'src', 'components', 'HeroBanner.tsx'))
  await writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 1\r\nexport const b = 2\r\n')
  await writeFile(path.join(root, 'src', 'payments', 'pay.ts'), 'export const fee = 1\n')
  await writeFile(path.join(root, '.env'), 'SECRET=do-not-touch\n')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, scripts: { test: options.testPasses === false ? 'node -e "process.exit(1)"' : 'node -e "process.exit(0)"' } }))
  await writeFile(path.join(root, '.gitignore'), '.perfagent\n')
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 'test@example.com'], ['config', 'user.name', 'Test'], ['config', 'commit.gpgsign', 'false'], ['add', '-A'], ['commit', '-q', '-m', 'init']]) await run('git', args, { cwd: root })

  const report = JSON.parse(await readFile(reportFile, 'utf8')) as Report
  const heroIssue = report.issues.find((i) => i.location?.file === 'src/components/HeroBanner.tsx' && i.fix.automatic) as Issue
  const aiIssue: Issue = { ...heroIssue, id: 'ai/test@src/a.ts:1', ruleId: 'ai/test', title: 'Needs AI', location: { file: 'src/a.ts', line: 1 }, fix: { steps: ['ask'], changes: [], automatic: false }, gain: { ...heroIssue.gain, scoreDelta: 1 } }
  report.issues = [heroIssue, aiIssue]
  const store = new ReportStore(root)
  await store.save(report)
  const config = configSchema.parse({ root, urls: [], fix: { review: false, ...(options.configOverrides ?? {}) } })
  const gitLog: string[][] = []
  const spy: typeof git = (r, args) => {
    gitLog.push(args)
    return git(r, args)
  }
  return { root, config, store, report, heroIssue, aiIssue, gitLog, git: spy }
}

/** AiService stand-in: `proposeFix` returns whatever the test scripted. */
export function stubAi(script: () => ProposedChange[] = () => []): AiService & { calls: number } {
  const stub = {
    calls: 0,
    providers: () => Promise.resolve([]),
    testConnection: () => Promise.resolve({ ok: true, message: '', latencyMs: 0 }),
    storeKey: () => Promise.resolve(),
    removeKey: () => Promise.resolve(),
    explain: () => Promise.resolve('explained'),
    proposeFix: () => { stub.calls++; return Promise.resolve(script()) },
    summarise: () => Promise.resolve('summary'),
    usage: () => Promise.resolve({ monthUsd: 0, calls: 0 }),
    activeProvider: () => Promise.resolve('openai' as const),
    report: () => Promise.resolve({ calls: [], callSites: [], models: [] }),
    compareModels: () => Promise.resolve([]),
  }
  return stub
}

export function request(repo: Repo, issue: Issue, extra: Partial<FixRunRequest> = {}): FixRunRequest {
  return { reportId: repo.report.id, scope: { kind: 'issue', issueIds: [issue.id] }, ...extra }
}

export async function currentBranch(root: string): Promise<string> {
  return (await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root })).stdout.trim()
}
