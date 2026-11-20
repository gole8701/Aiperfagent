import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { PerfAgentError } from '@perfagent/core'

import { configSchema, type PerfAgentConfig, type PerfAgentConfigInput } from './schema.js'

export const CONFIG_FILES = [
  'perfagent.config.ts',
  'perfagent.config.js',
  'perfagent.config.mjs',
  'perfagent.config.json',
]

export interface LoadOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  /** CLI flags, highest priority. */
  overrides?: Partial<PerfAgentConfigInput>
}

export interface LoadedConfig {
  config: PerfAgentConfig
  /** Absolute path of the file used, if any. */
  file?: string
}

/** Load order: defaults → config file → PERFAGENT_* env → CLI flags. */
export async function loadConfig(options: LoadOptions = {}): Promise<LoadedConfig> {
  const cwd = options.cwd ?? process.cwd()
  const file = await findConfigFile(cwd)
  const fromFile = file ? await readConfigFile(file) : {}
  const merged = deepMerge(
    deepMerge(fromFile, envOverrides(options.env ?? process.env)),
    options.overrides ?? {},
  )
  const parsed = configSchema.safeParse(merged)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first ? `${first.path.join('.')}: ${first.message}` : 'invalid config'
    throw new PerfAgentError(
      'CONFIG_INVALID',
      `Config problem at ${where}`,
      `Fix it in ${file ?? 'perfagent.config.ts'} or run "perfagent init".`,
    )
  }
  const config = parsed.data
  config.root = path.resolve(file ? path.dirname(file) : cwd, config.root)
  return { config, file }
}

export async function findConfigFile(cwd: string): Promise<string | undefined> {
  for (const name of CONFIG_FILES) {
    const candidate = path.join(cwd, name)
    try {
      await access(candidate)
      return candidate
    } catch {
      /* keep looking */
    }
  }
  return undefined
}

async function readConfigFile(file: string): Promise<Record<string, unknown>> {
  if (file.endsWith('.json')) {
    return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
  }
  if (file.endsWith('.ts')) {
    // Node 22.6+ strips types natively; older versions need tsx. Try native first.
    const major = Number(process.versions.node.split('.')[0])
    if (major < 23) {
      const require = createRequire(import.meta.url)
      try {
        require.resolve('tsx')
      } catch {
        throw new PerfAgentError(
          'CONFIG_INVALID',
          'perfagent.config.ts needs Node 23+ or the "tsx" package.',
          'Rename it to perfagent.config.js or install tsx.',
        )
      }
    }
  }
  const mod = (await import(pathToFileURL(file).href)) as { default?: unknown }
  const value: unknown = mod.default ?? mod
  return (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
}

/** `PERFAGENT_SERVER_PORT=5000` → `{ server: { port: 5000 } }`. */
export function envOverrides(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(env)) {
    if (!key.startsWith('PERFAGENT_') || raw === undefined) continue
    const segments = key.slice('PERFAGENT_'.length).toLowerCase().split('_').map(camel)
    let cursor = out
    for (const [i, seg] of segments.entries()) {
      if (i === segments.length - 1) cursor[seg] = coerce(raw)
      else cursor = (cursor[seg] ??= {}) as Record<string, unknown>
    }
  }
  return out
}

const KNOWN_CAMEL: Record<string, string> = {
  monthlybudgetusd: 'monthlyBudgetUsd',
  maxperfixusd: 'maxPerFixUsd',
  sendcode: 'sendCode',
  auditlog: 'auditLog',
  logprompts: 'logPrompts',
  runtests: 'runTests',
  testcommand: 'testCommand',
  autocommit: 'autoCommit',
  maxrounds: 'maxRounds',
  maxfiles: 'maxFiles',
  maxcostusd: 'maxCostUsd',
  samplerate: 'sampleRate',
  windowseconds: 'windowSeconds',
  peakthresholdp95ms: 'peakThresholdP95Ms',
  baseurl: 'baseUrl',
  budgetusdperday: 'budgetUsdPerDay',
}
function camel(segment: string): string {
  return KNOWN_CAMEL[segment] ?? segment
}

function coerce(raw: string): unknown {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  if (raw.includes(',')) return raw.split(',').map((s) => s.trim())
  return raw
}

export function deepMerge(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key]
    if (isPlainObject(current) && isPlainObject(value)) out[key] = deepMerge(current, value)
    else if (value !== undefined) out[key] = value
  }
  return out
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
