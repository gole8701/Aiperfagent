import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { globToRegExp, guardPath, isBlocked, matchesAnyGlob } from '../src/index.js'

let root: string
let outside: string

beforeAll(async () => {
  outside = await mkdtemp(path.join(os.tmpdir(), 'perfagent-outside-'))
  root = await mkdtemp(path.join(os.tmpdir(), 'perfagent-root-'))
  await mkdir(path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'src', 'app.ts'), 'export {}')
  await writeFile(path.join(root, '.env'), 'SECRET=1')
  await writeFile(path.join(outside, 'secret.txt'), 'nope')
  await symlink(path.join(outside, 'secret.txt'), path.join(root, 'src', 'escape.txt'))
})

describe('guardPath', () => {
  it('allows files inside the root', async () => {
    const g = await guardPath(root, 'src/app.ts')
    expect(g.relative).toBe('src/app.ts')
  })

  it.each(['../outside', '../../etc/passwd', 'src/../../x', '/etc/passwd', 'src/\0x'])(
    'blocks %s',
    async (p) => {
      await expect(guardPath(root, p)).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' })
    },
  )

  it('blocks symlinks that point outside', async () => {
    await expect(guardPath(root, 'src/escape.txt')).rejects.toMatchObject({
      code: 'PATH_OUTSIDE_ROOT',
    })
  })

  it('never reads .env, keys or node_modules', async () => {
    await expect(guardPath(root, '.env')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' })
    expect(isBlocked('.env.local')).toBe(true)
    expect(isBlocked('config/server.pem')).toBe(true)
    expect(isBlocked('node_modules/x/index.js')).toBe(true)
    expect(isBlocked('.git/config')).toBe(true)
    expect(isBlocked('src/env.ts')).toBe(false)
  })

  it('allows a missing file only when its parent is inside the root', async () => {
    const g = await guardPath(root, 'src/new-file.ts', { allowMissing: true })
    expect(g.relative).toBe('src/new-file.ts')
    await expect(guardPath(root, '../new.ts', { allowMissing: true })).rejects.toMatchObject({
      code: 'PATH_OUTSIDE_ROOT',
    })
  })
})

describe('globToRegExp', () => {
  it('matches any depth with **', () => {
    expect(globToRegExp('src/**').test('src/components/deep/File.tsx')).toBe(true)
    expect(globToRegExp('**/node_modules/**').test('a/b/node_modules/c/d.js')).toBe(true)
    expect(globToRegExp('**/node_modules/**').test('node_modules/c.js')).toBe(true)
    expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false)
    expect(globToRegExp('src/payments/**').test('src/payments/charge.ts')).toBe(true)
    expect(matchesAnyGlob('src/payments/charge.ts', ['src/payments/**'])).toBe(true)
    expect(matchesAnyGlob('src/cart.ts', ['src/payments/**'])).toBe(false)
  })
})
