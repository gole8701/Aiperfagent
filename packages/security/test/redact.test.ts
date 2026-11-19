import { describe, expect, it } from 'vitest'

import { isPrivate, redact, redactHeaders, redactText, redactUrl } from '../src/index.js'

describe('redaction', () => {
  it('strips API keys, tokens, JWTs, private keys and emails from text', () => {
    const text = [
      'key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789',
      'aws AKIAIOSFODNN7EXAMPLE',
      'gh ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
      'mail someone@example.com',
      'password = hunter2secret',
      '-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----',
    ].join('\n')
    const out = redactText(text)
    expect(out).not.toMatch(/sk-ant|AKIA|ghp_|eyJ|hunter2|someone@|MIIE/)
    expect(out).toMatch(/\[redacted/)
  })

  it('keeps ordinary code untouched', () => {
    const code = "const total = lines.reduce((sum, l) => sum + l.quantity, 0)\nimport { format } from 'date-fns'"
    expect(redactText(code)).toBe(code)
  })

  it('removes secret query parameters and headers', () => {
    expect(redactUrl('https://api.example.com/v1?token=abc&page=2')).toBe('https://api.example.com/v1?token=redacted&page=2')
    const headers = redactHeaders({ Authorization: 'Bearer x', Cookie: 'a=b', 'Content-Type': 'text/html' })
    expect(headers.Authorization).toBe('[redacted]')
    expect(headers.Cookie).toBe('[redacted]')
    expect(headers['Content-Type']).toBe('text/html')
  })

  it('walks objects, including HAR-like shapes', () => {
    const har = { log: { entries: [{ request: { url: 'https://x.test/?sig=abc', headers: { cookie: 'session=1' }, postData: { text: 'apiKey: "sk-live-abcdefghijklmnopqrstu"' } }, password: 'p' }] } }
    const out = redact(har)
    const entry = out.log.entries[0]
    expect(entry?.request.url).toContain('sig=redacted')
    expect(entry?.request.headers.cookie).toBe('[redacted]')
    expect(entry?.password).toBe('[redacted]')
    expect(JSON.stringify(out)).not.toContain('sk-live')
  })
})

describe('private network detection (SSRF guard)', () => {
  it.each(['10.0.0.1', '172.16.5.5', '192.168.1.1', '169.254.169.254', '100.64.0.1', 'fd00::1', '::ffff:10.0.0.1'])('%s is private', (ip) => {
    expect(isPrivate(ip)).toBe(true)
  })
  it.each(['8.8.8.8', '142.250.0.1', '2606:4700::1111'])('%s is public', (ip) => {
    expect(isPrivate(ip)).toBe(false)
  })
})
