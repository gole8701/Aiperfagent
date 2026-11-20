import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { PerfAgentConfig } from '@perfagent/config'

export interface CheckResult {
  name: string
  ok: boolean
  output: string
}

const CHECK_TIMEOUT_MS = 10 * 60_000
const MAX_OUTPUT = 4000

/**
 * The project's own safety net, in order: typecheck, lint, tests, build.
 * Every command is an argv array for execFile; nothing goes through a shell.
 * Stops at the first failure so the AI gets one clear error to repair.
 */
export async function runChecks(root: string, fix: PerfAgentConfig['fix']): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  for (const check of await plannedChecks(root, fix)) {
    const result = await runCheck(root, check)
    results.push(result)
    if (!result.ok) break
  }
  return results
}

interface PlannedCheck {
  name: string
  command: string
  args: string[]
}

async function plannedChecks(root: string, fix: PerfAgentConfig['fix']): Promise<PlannedCheck[]> {
  const scripts = await packageScripts(root)
  const pm = await packageManager(root)
  const checks: PlannedCheck[] = []
  const tsc = path.join(root, 'node_modules', '.bin', 'tsc')
  if ((await exists(path.join(root, 'tsconfig.json'))) && (await exists(tsc))) checks.push({ name: 'typecheck', command: tsc, args: ['--noEmit'] })
  if (scripts.lint) checks.push({ name: 'lint', command: pm, args: ['run', 'lint'] })
  if (fix.runTests) {
    if (fix.testCommand) {
      const [command, ...args] = fix.testCommand.split(/\s+/).filter(Boolean)
      if (command) checks.push({ name: 'tests', command, args })
    } else if (scripts.test) checks.push({ name: 'tests', command: pm, args: ['run', 'test'] })
  }
  if (scripts.build) checks.push({ name: 'build', command: pm, args: ['run', 'build'] })
  return checks
}

function runCheck(root: string, check: PlannedCheck): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile(check.command, check.args, { cwd: root, timeout: CHECK_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } }, (error, stdout, stderr) => {
      const output = `${stdout}\n${stderr}`.trim().slice(-MAX_OUTPUT)
      resolve({ name: check.name, ok: !error, output: error && !output ? error.message : output })
    })
  })
}

async function packageScripts(root: string): Promise<Record<string, string>> {
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
    return pkg.scripts ?? {}
  } catch {
    return {}
  }
}

async function packageManager(root: string): Promise<string> {
  if (await exists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (await exists(path.join(root, 'yarn.lock'))) return 'yarn'
  if ((await exists(path.join(root, 'bun.lockb'))) || (await exists(path.join(root, 'bun.lock')))) return 'bun'
  return 'npm'
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(() => true, () => false)
}
