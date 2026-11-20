import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createKeyStore } from '../src/index.js'

const KEY = 'sk-test-1234567890abcdef3f9'
let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'perfagent-keys-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('file key store', () => {
  it('encrypts keys at rest and still round-trips them', async () => {
    await createKeyStore({ dir, fileOnly: true }).store('openai', KEY)
    const onDisk = await readFile(path.join(dir, 'keys.json'), 'utf8')
    expect(onDisk).not.toContain(KEY)
    expect(onDisk).not.toContain('openai')
    expect((await stat(path.join(dir, '.keysecret'))).mode & 0o777).toBe(0o600)
    // A fresh store (new process) reads it back with the same per-machine secret.
    expect(await createKeyStore({ dir, fileOnly: true }).read('openai')).toEqual({
      key: KEY,
      source: 'file',
    })
  })

  it('migrates an old plaintext file once', async () => {
    await writeFile(path.join(dir, 'keys.json'), JSON.stringify({ openai: KEY }))
    const store = createKeyStore({ dir, fileOnly: true })
    expect((await store.read('openai'))?.key).toBe(KEY)
    expect(await readFile(path.join(dir, 'keys.json'), 'utf8')).not.toContain(KEY)
    expect((await store.read('openai'))?.key).toBe(KEY)
  })
})
