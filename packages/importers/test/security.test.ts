import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { assertImportSize, importReport } from '../src/index.js'

import { expectValid, fixtures } from './helpers.js'

describe('untrusted input', () => {
  it('keeps script tags as plain text, never markup', async () => {
    const payload = '<script>alert(1)</script>'
    const text = `Page: /x${encodeURIComponent(payload)}\nLCP 2.1 s`
    const r = await importReport({ text, filename: `${payload}.txt` })
    expectValid(r)
    expect(r.report.label).toBe(`${payload}.txt`)
    expect(JSON.stringify(r.report)).not.toContain('<script>alert(1)</script>"')
    expect(typeof r.report.pages[0]?.url).toBe('string')

    const har = { log: { entries: [{ startedDateTime: '2026-01-01T00:00:00Z', time: 10, request: { url: `https://a.example/${payload}` }, response: { status: 200, content: { mimeType: 'text/html' } }, timings: { wait: 5 } }] } }
    const h = await importReport({ text: JSON.stringify(har) })
    expectValid(h)
    expect(h.report.pages[0]?.requests[0]?.url).toContain(encodeURIComponent('<script>').slice(0, 3))
  })

  it('redacts secrets in a HAR: auth headers, cookies, tokens in URLs and bodies', async () => {
    const r = await importReport({ buffer: await readFile(path.join(fixtures, 'checkout.har')), filename: 'checkout.har' })
    const json = JSON.stringify(r.report)
    expect(json).not.toContain('sess_8f1a2b3c4d5e6f7a8b9c')
    expect(json).not.toContain('sk-live-1234567890abcdefghij')
    expect(json).not.toContain('abc123def456ghi789')
    expect(json).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(json).not.toContain('jane.doe@example.com')
    expect(json).not.toContain('"cookies"')
    expect(json).not.toContain('"headers"')
    expect(json).not.toContain('postData')
    expect(r.report.pages[0]?.url).toContain('token=redacted')
    expect(r.report.pages[0]?.requests.find((q) => q.url.includes('/api/cart'))?.url).toContain('api_key=redacted')
  })

  it('throws IMPORT_INVALID for empty and unknown input', async () => {
    await expect(importReport({ buffer: new Uint8Array() })).rejects.toMatchObject({ code: 'IMPORT_INVALID' })
    await expect(importReport({ text: '' })).rejects.toMatchObject({ code: 'IMPORT_INVALID' })
    await expect(importReport({ text: '{"hello":"world"}' })).rejects.toMatchObject({ code: 'IMPORT_INVALID' })
    await expect(importReport({ buffer: new Uint8Array([0, 1, 2, 3, 255, 254]) })).rejects.toMatchObject({ code: 'IMPORT_INVALID' })
  })

  it('rejects anything over the size cap before parsing', async () => {
    expect(() => assertImportSize(61 * 1024 * 1024)).toThrow(expect.objectContaining({ code: 'IMPORT_TOO_LARGE' }))
    const huge = new Uint8Array(8)
    Object.defineProperty(huge, 'byteLength', { get: () => 61 * 1024 * 1024 })
    await expect(importReport({ buffer: huge })).rejects.toMatchObject({ code: 'IMPORT_TOO_LARGE' })
  })

  it('survives 10,000 nested arrays', async () => {
    const text = '['.repeat(10_000) + ']'.repeat(10_000)
    await expect(importReport({ text })).rejects.toMatchObject({ code: 'IMPORT_INVALID' })
  })

  it('reports an unreadable PDF as IMPORT_INVALID', async () => {
    const fake = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 1)])
    await expect(importReport({ buffer: fake, filename: 'broken.pdf' })).rejects.toMatchObject({ code: 'IMPORT_INVALID' })
  })
})

describe('large HAR (slow)', () => {
  it('imports a ~12 MB HAR with response bodies in under 5 s', async () => {
    const entries: string[] = []
    const body = 'x'.repeat(4000)
    for (let i = 0; i < 2500; i++) {
      entries.push(JSON.stringify({
        pageref: 'p1', startedDateTime: new Date(1_700_000_000_000 + i * 3).toISOString(), time: 20 + (i % 50),
        request: { url: `https://shop.example/asset-${i}.js`, method: 'GET', headers: [{ name: 'cookie', value: 'a=b' }] },
        response: { status: 200, headersSize: 200, bodySize: 1000, _transferSize: 1200, content: { mimeType: 'application/javascript', size: 4000, text: body } },
        timings: { wait: 10, receive: 5 }, _resourceType: i === 0 ? 'document' : 'script',
      }))
    }
    const har = `{"log":{"version":"1.2","pages":[{"id":"p1","startedDateTime":"${new Date(1_700_000_000_000).toISOString()}","pageTimings":{"onContentLoad":500}}],"entries":[${entries.join(',')}]}}`
    const buffer = Buffer.from(har)
    expect(buffer.byteLength).toBeGreaterThan(10 * 1024 * 1024)
    const started = performance.now()
    const r = await importReport({ buffer, filename: 'big.har' })
    expect(performance.now() - started).toBeLessThan(5000)
    expectValid(r)
    expect(r.report.pages[0]?.requests).toHaveLength(2500)
    expect(r.report.pages[0]?.metrics.find((m) => m.id === 'requests')?.value).toBe(2500)
  }, 30_000)
})
