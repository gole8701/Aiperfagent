import { execFile } from 'node:child_process'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import type { ProviderId } from './providers/types.js'

const run = promisify(execFile)
const SERVICE = 'perfagent'
const ENV_NAMES: Partial<Record<ProviderId, string>> = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' }

export type KeySource = 'keychain' | 'file' | 'env'

export interface StoredKey {
  key: string
  source: KeySource
}

export interface KeyStoreOptions {
  /** Folder for the file fallback; defaults to `~/.perfagent`. */
  dir?: string
  /** Force the file store (tests, CI). */
  fileOnly?: boolean
}

export interface KeyStore {
  read(provider: ProviderId): Promise<StoredKey | undefined>
  store(provider: ProviderId, key: string): Promise<KeySource>
  remove(provider: ProviderId): Promise<void>
}

/** `sk-ant-…3f9` → `••••3f9`; the only form of a key that ever leaves this module. */
export function maskKey(key: string): string {
  return `••••${key.slice(-3)}`
}

/**
 * Keys live in the OS keychain (macOS `security`, Linux `secret-tool`), called
 * with fixed argument arrays. Without a keychain tool they go to a 0600 file.
 */
export function createKeyStore(options: KeyStoreOptions = {}): KeyStore {
  const dir = options.dir ?? path.join(os.homedir(), '.perfagent')
  const file = path.join(dir, 'keys.json')
  const keychain = options.fileOnly ? undefined : keychainFor(process.platform)

  async function readFileStore(): Promise<Record<string, string>> {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as Record<string, string>
    } catch {
      return {}
    }
  }

  async function writeFileStore(keys: Record<string, string>): Promise<void> {
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await writeFile(file, JSON.stringify(keys), { mode: 0o600 })
    await chmod(file, 0o600).catch(() => undefined)
  }

  return {
    async read(provider) {
      const env = ENV_NAMES[provider]
      const fromEnv = env ? process.env[env] : undefined
      if (fromEnv) return { key: fromEnv, source: 'env' }
      if (keychain) {
        const key = await keychain.read(provider).catch(() => undefined)
        if (key) return { key, source: 'keychain' }
      }
      const key = (await readFileStore())[provider]
      return key ? { key, source: 'file' } : undefined
    },
    async store(provider, key) {
      if (keychain) {
        const ok = await keychain.store(provider, key).then(() => true, () => false)
        if (ok) return 'keychain'
      }
      await writeFileStore({ ...(await readFileStore()), [provider]: key })
      return 'file'
    },
    async remove(provider) {
      if (keychain) await keychain.remove(provider).catch(() => undefined)
      const { [provider]: removed, ...rest } = await readFileStore()
      if (removed !== undefined) await writeFileStore(rest)
    },
  }
}

interface Keychain {
  read(provider: string): Promise<string | undefined>
  store(provider: string, key: string): Promise<void>
  remove(provider: string): Promise<void>
}

function keychainFor(platform: NodeJS.Platform): Keychain | undefined {
  const opts = { timeout: 10_000 }
  if (platform === 'darwin') {
    return {
      read: async (p) => (await run('security', ['find-generic-password', '-s', SERVICE, '-a', p, '-w'], opts)).stdout.trim() || undefined,
      store: async (p, key) => { await run('security', ['add-generic-password', '-U', '-s', SERVICE, '-a', p, '-w', key], opts) },
      remove: async (p) => { await run('security', ['delete-generic-password', '-s', SERVICE, '-a', p], opts) },
    }
  }
  if (platform === 'linux') {
    return {
      read: async (p) => (await run('secret-tool', ['lookup', 'service', SERVICE, 'account', p], opts)).stdout.trim() || undefined,
      store: (p, key) => runWithStdin('secret-tool', ['store', '--label', `PerfAgent ${p}`, 'service', SERVICE, 'account', p], key),
      remove: async (p) => { await run('secret-tool', ['clear', 'service', SERVICE, 'account', p], opts) },
    }
  }
  // Windows: cmdkey cannot read secrets back without extra modules, so the 0600 file is used.
  return undefined
}

/** The secret goes through stdin so it never shows up in the process list. */
function runWithStdin(command: string, args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { timeout: 10_000 }, (error) => {
      if (error) reject(new Error(error.message))
      else resolve()
    })
    child.stdin?.end(input)
  })
}
