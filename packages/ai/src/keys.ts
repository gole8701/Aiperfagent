import { execFile } from 'node:child_process'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import type { ProviderId } from './providers/types.js'

const run = promisify(execFile)
const SERVICE = 'perfagent'
const ENV_NAMES: Partial<Record<ProviderId, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

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
 * with fixed argument arrays. Without a keychain tool they go to a 0600 file,
 * encrypted with AES-256-GCM under a random per-machine secret kept in a second 0600 file.
 */
export function createKeyStore(options: KeyStoreOptions = {}): KeyStore {
  const dir = options.dir ?? path.join(os.homedir(), '.perfagent')
  const file = path.join(dir, 'keys.json')
  const keychain = options.fileOnly ? undefined : keychainFor(process.platform)

  const secretFile = path.join(dir, '.keysecret')

  async function writePrivate(target: string, data: string | Buffer): Promise<void> {
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await writeFile(target, data, { mode: 0o600 })
    await chmod(target, 0o600).catch(() => undefined)
  }

  async function secret(): Promise<Buffer> {
    const existing = await readFile(secretFile).catch(() => undefined)
    if (existing?.length === 32) return existing
    const created = randomBytes(32)
    await writePrivate(secretFile, created)
    return created
  }

  async function readFileStore(): Promise<Record<string, string>> {
    let parsed: { v?: number; iv?: string; tag?: string; data?: string } & Record<string, unknown>
    try {
      parsed = JSON.parse(await readFile(file, 'utf8')) as typeof parsed
    } catch {
      return {}
    }
    if (parsed.v !== 1) {
      // Plaintext file from an older version: encrypt it in place once.
      const keys = parsed as Record<string, string>
      await writeFileStore(keys)
      return keys
    }
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        await secret(),
        Buffer.from(parsed.iv ?? '', 'base64'),
      )
      decipher.setAuthTag(Buffer.from(parsed.tag ?? '', 'base64'))
      const plain = Buffer.concat([
        decipher.update(Buffer.from(parsed.data ?? '', 'base64')),
        decipher.final(),
      ])
      return JSON.parse(plain.toString('utf8')) as Record<string, string>
    } catch {
      // Wrong or missing secret: the stored keys cannot be recovered, so treat them as absent.
      return {}
    }
  }

  async function writeFileStore(keys: Record<string, string>): Promise<void> {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', await secret(), iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(keys), 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    await writePrivate(
      file,
      JSON.stringify({
        v: 1,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: data.toString('base64'),
      }),
    )
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
        const ok = await keychain.store(provider, key).then(
          () => true,
          () => false,
        )
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
      read: async (p) =>
        (
          await run('security', ['find-generic-password', '-s', SERVICE, '-a', p, '-w'], opts)
        ).stdout.trim() || undefined,
      // `security -i` reads the command from stdin, so the key never appears in the process list.
      store: async (p, key) => {
        if (/["\\\s]/.test(key))
          throw new Error('Key has characters the keychain command cannot take')
        await runWithStdin(
          'security',
          ['-i'],
          `add-generic-password -U -s "${SERVICE}" -a "${p}" -w "${key}"\n`,
        )
        // `security -i` exits 0 even when the command fails, so read the key back.
        const saved = (
          await run('security', ['find-generic-password', '-s', SERVICE, '-a', p, '-w'], opts)
        ).stdout.trim()
        if (saved !== key) throw new Error('Keychain did not store the key')
      },
      remove: async (p) => {
        await run('security', ['delete-generic-password', '-s', SERVICE, '-a', p], opts)
      },
    }
  }
  if (platform === 'linux') {
    return {
      read: async (p) =>
        (
          await run('secret-tool', ['lookup', 'service', SERVICE, 'account', p], opts)
        ).stdout.trim() || undefined,
      store: (p, key) =>
        runWithStdin(
          'secret-tool',
          ['store', '--label', `PerfAgent ${p}`, 'service', SERVICE, 'account', p],
          key,
        ),
      remove: async (p) => {
        await run('secret-tool', ['clear', 'service', SERVICE, 'account', p], opts)
      },
    }
  }
  // Windows: cmdkey cannot read secrets back without extra modules, so the encrypted 0600 file is used.
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
