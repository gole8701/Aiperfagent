import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { AiCallSample } from '@perfagent/core'
import { afterAll, describe, expect, it } from 'vitest'

import { createAiProxy, watchAI, watchFetch, withRoute, wrapAI } from '../src/index.js'

import { startStubServer } from './stub-server.js'

const dir = await mkdtemp(path.join(os.tmpdir(), 'perfagent-watch-'))
afterAll(() => rm(dir, { recursive: true, force: true }))

/** Minimal Anthropic-shaped client with a private field, like the real SDK. */
class FakeAnthropic {
  #secret = 'private-state'
  messages = {
    create: async (params: { model: string; stream?: boolean }) => {
      if (!params.stream)
        return {
          model: params.model,
          content: [{ type: 'text', text: 'hi' }],
          usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 4 },
        }
      return (async function* () {
        yield {
          type: 'message_start',
          message: { model: params.model, usage: { input_tokens: 10, cache_read_input_tokens: 0 } },
        }
        await new Promise((r) => setTimeout(r, 5))
        yield { type: 'content_block_delta', delta: { text: 'hel' } }
        yield { type: 'message_delta', usage: { output_tokens: 7 } }
      })()
    },
  }
  whoami(): string {
    return this.#secret
  }
}

function collect(): {
  samples: AiCallSample[]
  options: { onSample: (s: AiCallSample) => void; file: string }
} {
  const samples: AiCallSample[] = []
  return {
    samples,
    options: { onSample: (s) => samples.push(s), file: path.join(dir, 'samples.jsonl') },
  }
}

describe('watchAI', () => {
  it('records a non-streaming Anthropic call with tokens, cost and model, keeping private fields working', async () => {
    const { samples, options } = collect()
    const client = watchAI(new FakeAnthropic(), options)
    const result = await client.messages.create({ model: 'claude-sonnet-4-5' })
    expect(result.content[0]?.text).toBe('hi')
    expect(client.whoami()).toBe('private-state')
    expect(samples[0]).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      inputTokens: 10,
      outputTokens: 5,
      cachedTokens: 4,
      retries: 0,
      stalls: 0,
    })
    expect(samples[0]?.costUsd).toBeGreaterThan(0)
    expect(JSON.stringify(samples[0])).not.toContain('prompt')
  })

  it('measures first token and usage across a stream', async () => {
    const { samples, options } = collect()
    const client = watchAI(new FakeAnthropic(), options)
    const chunks: unknown[] = []
    for await (const chunk of await client.messages.create({
      model: 'claude-sonnet-4-5',
      stream: true,
    }))
      chunks.push(chunk)
    expect(chunks).toHaveLength(3)
    expect(samples[0]).toMatchObject({ inputTokens: 10, outputTokens: 7 })
    expect(samples[0]?.firstTokenMs).toBeLessThanOrEqual(samples[0]?.totalMs ?? 0)
  })

  it('records errors, retries and the route from withRoute, plus agent steps', async () => {
    const { samples, options } = collect()
    let calls = 0
    const client = watchAI(
      {
        chat: {
          completions: {
            create: async () => {
              if (++calls === 1) throw Object.assign(new Error('rate limited'), { status: 429 })
              return { model: 'gpt-4o', usage: { prompt_tokens: 1, completion_tokens: 1 } }
            },
          },
        },
      },
      options,
    )
    await withRoute('/checkout', async () => {
      await watchAI.step('rag', 'vector-search', () => new Promise((r) => setTimeout(r, 2)))
      await expect(client.chat.completions.create({ model: 'gpt-4o' })).rejects.toThrow(
        'rate limited',
      )
      await client.chat.completions.create({ model: 'gpt-4o' })
    })
    expect(samples[0]).toMatchObject({
      provider: 'openai',
      error: '429',
      retries: 0,
      route: '/checkout',
    })
    expect(samples[0]?.steps?.[0]).toMatchObject({ kind: 'rag', name: 'vector-search' })
    expect(samples[1]).toMatchObject({ retries: 1, route: '/checkout', outputTokens: 1 })
    expect(samples[1]?.error).toBeUndefined()
  })

  it('wraps Vercel-style functions', async () => {
    const { samples, options } = collect()
    const { generateText } = wrapAI(
      {
        generateText: async (o: { model: string }) => ({
          text: 'x',
          usage: { promptTokens: 3, completionTokens: 4 },
          model: o.model,
        }),
      },
      options,
    )
    await generateText({ model: 'gpt-4o-mini' })
    expect(samples[0]).toMatchObject({
      provider: 'vercel-ai',
      model: 'gpt-4o-mini',
      inputTokens: 3,
      outputTokens: 4,
    })
  })

  it('adds under 20 ms to 1,000 wrapped calls and writes JSON lines', async () => {
    const file = path.join(dir, 'perf.jsonl')
    const client = watchAI(
      {
        messages: {
          create: (p: { model: string }) => ({
            model: p.model,
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        },
      },
      { file, flushMs: 10 },
    )
    const started = performance.now()
    for (let i = 0; i < 1000; i++) client.messages.create({ model: 'claude-haiku-4-5' })
    expect(performance.now() - started).toBeLessThan(20)
    await new Promise((r) => setTimeout(r, 100))
    const lines = (await readFile(file, 'utf8')).trim().split('\n')
    expect(lines).toHaveLength(1000)
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    })
  })

  it('never throws into the app when the file cannot be written', async () => {
    const client = watchAI(
      { messages: { create: () => ({ usage: {} }) } },
      { file: '/nonexistent-root-dir/x/y.jsonl', flushMs: 5 },
    )
    expect(() => client.messages.create()).not.toThrow()
    await new Promise((r) => setTimeout(r, 30))
  })
})

describe('watchFetch and the proxy', () => {
  it('measures plain fetch calls to AI hosts only', async () => {
    const stub = await startStubServer()
    try {
      const { samples, options } = collect()
      const f = watchFetch(fetch, options)
      const direct = await f(`${stub.url}/v1/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
      })
      expect(direct.ok).toBe(true)
      expect(samples).toHaveLength(0) // 127.0.0.1 stub is not a known AI host
      const w = watchFetch(
        async (input, init) =>
          fetch(
            `${stub.url}/v1/chat/completions`,
            init && { method: input ? init.method : 'POST', body: init.body },
          ),
        options,
      )
      const res = await w('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
      })
      await res.json()
      await new Promise((r) => setTimeout(r, 20))
      expect(samples[0]).toMatchObject({ provider: 'openai', model: 'gpt-4o', inputTokens: 120 })
    } finally {
      await stub.close()
    }
  })

  it('forwards streamed requests and records TTFT and tokens with no code change', async () => {
    const stub = await startStubServer()
    const file = path.join(dir, 'proxy.jsonl')
    const proxy = await createAiProxy({ targetBaseUrl: stub.url, port: 0, file })
    try {
      const res = await fetch(`${proxy.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer sk-proxied' },
        body: JSON.stringify({ model: 'gpt-4.1-mini', stream: true, messages: [] }),
      })
      const text = await res.text()
      expect(text).toContain('[DONE]')
      expect(stub.requests[0]?.headers.authorization).toBe('Bearer sk-proxied')
    } finally {
      await proxy.close()
      await stub.close()
    }
    await new Promise((r) => setTimeout(r, 50))
    const sample = JSON.parse(
      (await readFile(file, 'utf8')).trim().split('\n')[0] ?? '{}',
    ) as AiCallSample
    expect(sample).toMatchObject({
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      inputTokens: 120,
      cachedTokens: 20,
    })
    expect(sample.firstTokenMs).toBeGreaterThan(0)
    expect(JSON.stringify(sample)).not.toContain('sk-proxied')
  })
})
