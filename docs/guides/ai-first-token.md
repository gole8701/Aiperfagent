---
title: AI first token
group: AI
summary: Time until the first word of an AI answer appears, and how smoothly the rest streams in.
order: 21
tryIt: /charts/ai
metric: aiFirstTokenMs
---

## What it is

AI first token (time to first token, TTFT) is the time from sending a question until the first word of the answer arrives.

It is what a person feels as "the AI is slow". A second metric, tokens per second, says how smoothly the rest of the answer streams in.

## Why it matters

People wait for the first word, then read along. Three seconds of nothing feels broken even if the full answer arrives in five.

## Use case

- Chatbots and support assistants.
- RAG answers where retrieval runs before the model.
- Choosing between models for an interactive feature.

## How it helps your app

The AI feels fast. On the demo shop, `answerSupportQuestion()` in `src/server/rag.ts` awaits four steps in sequence and sends a 9,800-token system prompt uncached; PerfAgent estimates first token 2.4 s → 0.9 s with `Promise.all` and → 1.1 s with prompt caching.

## Good, needs work, poor

| Metric          | Good  | Needs work | Poor  |
| --------------- | ----- | ---------- | ----- |
| AI first token  | ≤ 1 s | 1 s – 3 s  | > 3 s |
| AI tokens / sec | ≥ 30  | 10 – 30    | < 10  |

## How to do it in PerfAgent, step by step

1. **Editor:** wrap the client with `watchAI()` (see **Measure AI in your app**).
2. **Charts:** **AI → How long do users wait for an AI answer (per model)?** shows p50 and p95 first token per model.
3. **Globe:** click the **AI first token** chip to see the static findings.
4. **Globe:** apply the fixes: stream the answer, run independent steps in parallel, cache the stable prompt prefix, trim context.
5. **Globe:** **Re-test** is not available for AI calls; use **Compare** on two reports with measured samples, and set `aiFirstTokenMs: 1000` as a budget.

## Expert detail

- Measured by `watchAI` as the time from request start to the first streamed chunk with content; for non-streaming calls it equals the total time, which is why `ai/no-streaming` is a rule.
- Rules that target `aiFirstTokenMs`: `ai/sequential-await` (awaited AI, embedding or retrieval calls in a row or in a loop), `ai/no-streaming` (`messages.create` or `chat.completions.create` in chat-like files without `stream`), `ai/no-prompt-cache` (a `system` prompt built from a large constant or file, without `cache_control`), `ai/oversized-context`, `ai/model-overkill`, `ai/no-timeout`, `ai/embed-in-loop`, `ai/no-semantic-cache`, `ai/huge-tool-list`.
- Stalls: gaps between tokens above a threshold are counted per call (`stalls`) and shown as "frozen answer" moments.
- Tokens per second = output tokens ÷ (total time − first-token time).
- Budget keys: `aiFirstTokenMs` (p95 limit) and `aiCacheHitRate` in `budgets`.

## Walkthrough

```walkthrough
[
  { "screen": "charts", "area": "chart-1", "title": "Per model", "text": "p50 and p95 first-token time for each model you use." },
  { "screen": "globe", "area": "chips", "title": "AI first token chip", "text": "Static findings with file:line." },
  { "screen": "globe", "area": "chain", "title": "Four sequential steps", "text": "First token 2.4 s → 4 sequential steps in answerSupportQuestion() → rag.ts:28." },
  { "screen": "globe", "area": "fix", "title": "Parallel and cached", "text": "Promise.all for independent steps; cache_control on the system prompt." }
]
```

## Learn more

- [Anthropic: Streaming](https://docs.anthropic.com/en/docs/build-with-claude/streaming)
- [Anthropic: Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [MDN: Promise.all](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)

## हिन्दी

**यह क्या है:** AI फ़र्स्ट टोकन वह समय है जो सवाल भेजने से लेकर जवाब का पहला शब्द आने तक लगता है। यही "AI धीमा है" का एहसास है।

**उपयोग:** चैटबॉट, सपोर्ट असिस्टेंट, RAG जवाब, या किसी इंटरैक्टिव फ़ीचर के लिए मॉडल चुनते समय।

## मराठी

**हे काय आहे:** AI फर्स्ट टोकन म्हणजे प्रश्न पाठवल्यापासून उत्तराचा पहिला शब्द येईपर्यंतचा वेळ. हीच "AI हळू आहे" ही भावना.

**वापर:** चॅटबॉट, सपोर्ट असिस्टंट, RAG उत्तरे, किंवा इंटरॅक्टिव्ह फीचरसाठी मॉडेल निवडताना.
