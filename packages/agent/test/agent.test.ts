import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const SIZE_LIMIT = 8 * 1024

let out: string
beforeAll(async () => {
  out = await mkdtemp(path.join(os.tmpdir(), 'perfagent-agent-'))
  await build({ entryPoints: [path.join(here, '../src/agent.ts')], bundle: true, minify: true, format: 'iife', target: 'es2019', outfile: path.join(out, 'perfagent.js'), logLevel: 'silent' })
  await build({ entryPoints: [path.join(here, '../src/index.ts')], bundle: true, format: 'esm', target: 'es2019', outfile: path.join(out, 'index.js'), logLevel: 'silent' })
})
afterAll(() => rm(out, { recursive: true, force: true }))

/** Just enough browser for the snippet: timers, fetch, XHR, WebSocket, observers, history. */
function fakeBrowser(): { beacons: unknown[][]; emit: (type: string, entries: unknown[]) => void } {
  const beacons: unknown[][] = []
  const observers = new Map<string, (list: { getEntries: () => unknown[] }) => void>()
  const g = globalThis as Record<string, unknown>
  g.window = globalThis
  g.location = { pathname: '/checkout' }
  g.document = { visibilityState: 'visible', currentScript: null }
  g.addEventListener = () => undefined
  Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: (_url: string, blob: Blob) => { void blob.text().then((t) => beacons.push(JSON.parse(t) as unknown[])); return true } }, configurable: true })
  g.PerformanceObserver = class { constructor(private cb: (list: { getEntries: () => unknown[] }) => void) {} observe(o: { type: string }): void { observers.set(o.type, this.cb) } }
  g.XMLHttpRequest = class { status = 200; listeners: Record<string, () => void> = {}; open(): void { /* patched */ } addEventListener(n: string, cb: () => void): void { this.listeners[n] = cb } getResponseHeader(): string { return '12' } }
  g.WebSocket = class { listeners: Record<string, (e: unknown) => void> = {}; constructor(public url: string) {} addEventListener(n: string, cb: (e: unknown) => void): void { this.listeners[n] = cb } send(): void { /* native */ } }
  g.history = { pushState: () => undefined }
  g.fetch = () => Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'content-length': '11' } }))
  return { beacons, emit: (type, entries) => observers.get(type)?.({ getEntries: () => entries }) }
}

describe('@perfagent/agent', () => {
  it(`is at most ${SIZE_LIMIT} bytes minified`, async () => {
    const size = (await readFile(path.join(out, 'perfagent.js'))).length
    expect(size).toBeLessThanOrEqual(SIZE_LIMIT)
  })

  it('records vitals, requests without query strings, soft navigations and sends beacons', async () => {
    const browser = fakeBrowser()
    const { init } = (await import(path.join(out, 'index.js'))) as { init: (o: Record<string, unknown>) => void }
    init({ endpoint: 'http://127.0.0.1:4545/agent/collect', flushMs: 20 })
    browser.emit('largest-contentful-paint', [{ startTime: 1234.4, element: { tagName: 'IMG', id: 'hero', className: 'hero-image big' } }])
    browser.emit('longtask', [{ duration: 120 }])
    await fetch('https://shop.example/api/products?token=secret&page=2#x', { method: 'post' })
    const ws = new WebSocket('wss://shop.example/live?sid=1')
    ;(ws as unknown as { listeners: Record<string, (e: unknown) => void> }).listeners.open?.({})
    history.pushState({}, '', '/cart')
    await new Promise((r) => setTimeout(r, 60))
    const events = browser.beacons.flat() as Record<string, unknown>[]
    expect(events.find((e) => e.t === 'vital')).toMatchObject({ name: 'lcp', value: 1234, target: 'img#hero.hero-image', route: '/checkout' })
    expect(events.find((e) => e.t === 'task')).toMatchObject({ ms: 120 })
    expect(events.find((e) => e.t === 'req')).toMatchObject({ url: 'https://shop.example/api/products', method: 'POST', status: 200, size: 11 })
    expect(events.find((e) => e.t === 'ws')).toMatchObject({ url: 'wss://shop.example/live', kind: 'open', reconnects: 0 })
    expect(events.find((e) => e.t === 'nav')).toBeDefined()
    expect(JSON.stringify(events)).not.toContain('secret')
  })
})
