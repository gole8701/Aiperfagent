---
title: Measure AI in your app
group: AI
summary: Wrap your AI client with watchAI() to record first-token time, tokens, cost, cache hits, errors and agent steps, shown next to page speed.
order: 20
tryIt: /charts/ai
---

## What it is

Measuring AI means recording how long each AI call in your app takes, how many tokens it uses, what it costs and how often it fails.

PerfAgent collects this with `watchAI()`, a wrapper around the official SDK client that records timings and token usage from each response. Prompts and answers are not stored unless you turn `logPrompts` on. The same dashboard shows AI speed next to page speed, so you can see "LCP is fine, but the chat answer takes 6 s because the retrieval takes 4 s".

## Why it matters

Slow or expensive AI calls are a new kind of performance problem. A chatbot that takes 6 seconds to say its first word feels broken, and a prompt that re-sends 10,000 tokens on every call costs real money.

## Use case

- A chat or support assistant in your product.
- RAG pipelines (embed → search → answer).
- Agents that call tools in loops.
- Comparing two models on speed and cost.

## How it helps your app

You see the slow step, not just the slow answer. The AI rule pack also finds problems statically, without any measurement: on the demo shop, `src/server/rag.ts:28` awaits embed, search and order lookup one after another (`ai/sequential-await`) and sends a 9,800-token system prompt uncached on every call (`ai/no-prompt-cache`).

## How to do it in PerfAgent, step by step

1. **Editor:** wrap your client: `const client = watchAI(new Anthropic())`. The client works exactly as before.
2. **Terminal:** run your app with `npx perfagent` running; samples are posted to the local dashboard.
3. **Charts:** open **Charts → AI**. The four tiles show first token, cost today, cache reuse and failures; the charts below break it down per model and per step.
4. **Globe:** click the **AI** area chip to see the static findings with file:line, even before any measurement.
5. **Settings:** set `ai.budgetUsdPerDay` to draw the budget line on the cost chart.

## Commands & config

```ts
// Anthropic SDK
import Anthropic from '@anthropic-ai/sdk'
import { watchAI } from 'perfagent/ai'

const client = watchAI(new Anthropic())
const message = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 800,
  messages,
})

// OpenAI SDK or any OpenAI-compatible client
import OpenAI from 'openai'
const openai = watchAI(new OpenAI())

// Options: where to send samples, and whether to keep prompts (off by default)
const client = watchAI(new Anthropic(), { endpoint: 'http://127.0.0.1:4545', logPrompts: false })
```

```ts
export default defineConfig({
  ai: {
    logPrompts: false, // store prompts and answers of measured calls
    budgetUsdPerDay: 5, // budget line on the AI cost chart
  },
})
```

Other ways to get the data in: import an OpenTelemetry JSON export that follows the GenAI semantic conventions (`perfagent import traces.json`), or point your app's AI base URL at the local measuring proxy during development: `npx perfagent ai-proxy --target https://api.openai.com --port 4547`, then set `OPENAI_BASE_URL` (or `ANTHROPIC_BASE_URL`) to the printed URL. Samples go to `.perfagent/ai-samples.jsonl`.

## Expert detail

- `watchAI<T>(client: T, options?: { endpoint?: string; logPrompts?: boolean }): T` from `perfagent/ai` (re-exported from `@perfagent/ai/watch`). It wraps `messages.create`, `chat.completions.create`, `responses.create`, `generateContent` and the Vercel AI SDK helpers, and for streams measures time to first token and gaps between tokens (stalls).
- Each call becomes an `AiCallSample`: `at`, `route`, `model`, `provider`, `firstTokenMs`, `totalMs`, `inputTokens`, `outputTokens`, `cachedTokens`, `costUsd`, `error`, `retries`, `stalls`, and optional `steps[]` (`llm` | `tool` | `rag` with `ms`) for agent runs.
- Cost is tokens × the model's list price; prices are a table in `@perfagent/ai` and the chart says "estimate".
- Metrics: `aiFirstTokenMs` (good ≤ 1 s, poor > 3 s), `aiTokensPerSec` (good ≥ 30, poor < 10), `aiCostUsd`, `aiCacheHitRate` (good ≥ 70 %, poor < 30 %), `aiErrorRate` (good ≤ 1 %, poor > 5 %).
- The static AI pack (`packages/rules/src/packs/ai.ts`) has 15 rules: `ai/sequential-await`, `ai/no-streaming`, `ai/no-prompt-cache`, `ai/oversized-context`, `ai/model-overkill`, `ai/missing-max-tokens`, `ai/no-retry-backoff`, `ai/no-timeout`, `ai/no-semantic-cache`, `ai/embed-in-loop`, `ai/unstructured-parse`, `ai/huge-tool-list`, `ai/agent-loop`, `ai/client-side-key`, `ai/no-batch-for-offline`. They find AI call sites by SDK imports and call patterns.
- Everything measured stays in `.perfagent/`; nothing is sent to PerfAgent's authors. Samples are redacted before storage.

## Learn more

- [Anthropic: Streaming](https://docs.anthropic.com/en/docs/build-with-claude/streaming)
- [Anthropic: Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [OpenAI: Latency optimization](https://platform.openai.com/docs/guides/latency-optimization)
- [OpenTelemetry: GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
