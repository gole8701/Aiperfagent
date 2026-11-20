import { describe, expect, it } from 'vitest'

import {
  createSessionToken,
  extractToken,
  hostAllowed,
  originAllowed,
  requestRejection,
  tokenMatches,
} from '../src/index.js'

const policy = { port: 4545 }

describe('origin and host checks', () => {
  it('accepts the local dashboard address', () => {
    expect(hostAllowed('127.0.0.1:4545', policy)).toBe(true)
    expect(hostAllowed('localhost:4545', policy)).toBe(true)
    expect(originAllowed('http://127.0.0.1:4545', policy)).toBe(true)
    expect(originAllowed(undefined, policy)).toBe(true)
  })

  it('rejects other websites (CSRF / DNS rebinding)', () => {
    expect(originAllowed('https://evil.example', policy)).toBe(false)
    expect(originAllowed('http://127.0.0.1:9999', policy)).toBe(false)
    expect(originAllowed('null', policy)).toBe(false)
    expect(hostAllowed('evil.example', policy)).toBe(false)
    expect(hostAllowed('127.0.0.1.evil.example:4545', policy)).toBe(false)
    expect(
      requestRejection({ host: '127.0.0.1:4545', origin: 'https://evil.example' }, policy),
    ).toMatch(/another website/)
    expect(requestRejection({ host: 'attacker.test:4545' }, policy)).toMatch(/Host/)
    expect(
      requestRejection({ host: '127.0.0.1:4545', 'sec-fetch-site': 'cross-site' }, policy),
    ).toMatch(/Cross-site/)
    expect(
      requestRejection({ host: '127.0.0.1:4545', origin: 'http://127.0.0.1:4545' }, policy),
    ).toBeNull()
  })

  it('allows an explicitly configured dev origin', () => {
    expect(
      originAllowed('http://localhost:5173', {
        port: 4545,
        extraOrigins: ['http://localhost:5173'],
      }),
    ).toBe(true)
  })
})

describe('session token', () => {
  it('is long, random and compared in constant time', () => {
    const a = createSessionToken()
    const b = createSessionToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(40)
    expect(tokenMatches(a, a)).toBe(true)
    expect(tokenMatches(a, b)).toBe(false)
    expect(tokenMatches(a, undefined)).toBe(false)
    expect(tokenMatches(a, a.slice(1))).toBe(false)
  })

  it('is read from bearer header, query or cookie', () => {
    expect(extractToken({ authorization: 'Bearer abc' }, '/api/x')).toBe('abc')
    expect(extractToken({}, '/api/x?token=qry')).toBe('qry')
    expect(extractToken({ cookie: 'a=1; perfagent_token=ck' }, '/api/x')).toBe('ck')
    expect(extractToken({}, '/api/x')).toBeUndefined()
  })
})
