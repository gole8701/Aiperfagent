import type { SourceFile } from '@perfagent/scanner'

import { lineText, loc, pageMetric, replaceLine, snippet, type Finding, type Rule } from '../engine.js'

/**
 * AI rule pack. Finds AI call sites statically (no AI needed) and checks the
 * 15 patterns from the research file.
 */
const AI_CALL = /\b(messages\.create|chat\.completions\.create|responses\.create|generateContent|generateText|streamText|ollama\.(chat|generate)|embeddings\.create|embedContent|embed(Many)?|\.invoke|\.generate|openai\.|anthropic\.|client\.(messages|chat|responses)|llm\.|model\.)\b/
const EMBED = /embed|embedding/i
const BIG_MODEL = /(claude-opus|claude-3-opus|gpt-4o(?!-mini)|gpt-4-turbo|o1(-preview)?|gemini-1\.5-pro|gemini-2\.\d-pro|claude-sonnet|claude-opus-\d)/i
const SIMPLE_TASK = /classif|extract|sentiment|categor|label|tag|moderat|detect|yes\/no|boolean|summar(?:ise|ize) title/i

const docs = {
  streaming: { label: 'Anthropic: Streaming', url: 'https://docs.anthropic.com/en/docs/build-with-claude/streaming' },
  caching: { label: 'Anthropic: Prompt caching', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching' },
  parallel: { label: 'MDN: Promise.all', url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/all' },
  structured: { label: 'Anthropic: Tool use (structured outputs)', url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use' },
  batch: { label: 'Anthropic: Batch API', url: 'https://docs.anthropic.com/en/docs/build-with-claude/batch-processing' },
  keys: { label: 'OWASP: API key exposure', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html' },
}

function aiFiles(files: SourceFile[]): SourceFile[] {
  return files.filter((f) => AI_CALL.test(f.text) || f.imports.some((i) => /^(openai|@anthropic-ai\/sdk|@google\/genai|@google\/generative-ai|ai|langchain|@langchain\/|llamaindex|ollama|cohere-ai|@mistralai)/.test(i.source)))
}

function callLines(file: SourceFile): number[] {
  return file.text.split('\n').map((t, i) => (AI_CALL.test(t) ? i + 1 : 0)).filter(Boolean)
}

const base = (rule: Omit<Rule, 'pack' | 'areas'> & { areas?: Rule['areas'] }): Rule => ({ pack: 'ai', areas: ['ai'], ...rule })

/** 5. Sequential awaits of AI / embedding / retrieval calls. */
export const sequentialAwait = base({
  id: 'ai/sequential-await',
  title: 'AI calls run one after another',
  plain: 'The app waits for several AI steps in a row instead of at the same time',
  severity: 'critical',
  metrics: ['aiFirstTokenMs'],
  why: 'Each awaited call waits for the previous one. Independent calls (embedding + search + lookups) can run in parallel with Promise.all, cutting seconds off every answer.',
  frameworkRule: 'AI: parallel independent calls',
  docs: [docs.parallel],
  steps: ['Find awaited calls that do not depend on each other', 'Run them with Promise.all([...])', 'Keep dependent calls sequential'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const ttft = pageMetric(pages, 'aiFirstTokenMs') ?? 2400
    for (const file of aiFiles(scan.files)) {
      for (const fn of file.functions) {
        const aiAwaits = fn.awaits.filter((a) => AI_CALL.test(a.callee) || EMBED.test(a.callee) || /search|retrieve|query|rerank|lookup/i.test(a.callee))
        const inLoop = aiAwaits.filter((a) => a.inLoop)
        const consecutive = aiAwaits.length >= 2 && aiAwaits.every((a, i) => i === 0 || a.line - (aiAwaits[i - 1]?.line ?? 0) <= 4)
        if (!inLoop.length && !consecutive) continue
        const first = inLoop[0] ?? aiAwaits[0]
        if (!first) continue
        out.push({
          location: loc(file, first.line, fn.name),
          title: inLoop.length ? 'AI call awaited inside a loop' : `${aiAwaits.length} AI steps awaited in sequence`,
          chain: { metric: 'aiFirstTokenMs', value: ttft, cost: { label: `${aiAwaits.length} sequential steps in ${fn.name}()`, detail: 'each waits for the previous' }, code: { snippet: snippet(file, first.line, 2), location: loc(file, first.line) } },
          gain: { from: ttft, to: Math.max(600, ttft / Math.max(2, aiAwaits.length) + 300), scoreDelta: 0, note: 'seconds saved per request' },
          changes: [{ file: file.path, before: aiAwaits.slice(0, 2).map((a) => lineText(file, a.line).trim()).join('\n'), after: `const [${aiAwaits.slice(0, 2).map((_, i) => `r${i + 1}`).join(', ')}] = await Promise.all([\n  ${aiAwaits.slice(0, 2).map((a) => lineText(file, a.line).trim().replace(/^(const|let)\s+\w+\s*=\s*await\s*/, '')).join(',\n  ')}\n])` }],
          automatic: false,
          prevent: { metric: 'aiFirstTokenMs', max: 1000 },
        })
      }
    }
    return out
  },
})

export const noStreaming = base({
  id: 'ai/no-streaming',
  title: 'AI answer shown only when complete',
  plain: 'Users stare at a spinner until the whole AI answer is ready',
  severity: 'warning',
  metrics: ['aiFirstTokenMs'],
  why: 'Without streaming the first word appears only after the last one was generated. Streaming shows text as it arrives, which feels 3–10× faster.',
  docs: [docs.streaming],
  steps: ['Pass stream: true (or use the streaming helper)', 'Render tokens as they arrive'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /messages\.create|chat\.completions\.create|generateContent\(|generateText\(/.test(lineText(file, line)) && !/stream/i.test(snippet(file, line, 6)) && /chat|assistant|answer|respond/i.test(file.path), 'aiFirstTokenMs', (v) => ({ to: Math.max(400, v * 0.3), scoreDelta: 0 }), { confidence: 0.65 }),
})

export const noPromptCache = base({
  id: 'ai/no-prompt-cache',
  title: 'Long system prompt sent uncached every call',
  plain: 'The same long instructions are paid for again on every request',
  severity: 'critical',
  metrics: ['aiFirstTokenMs', 'aiCostUsd', 'aiCacheHitRate'],
  why: 'A long system prompt or document set is re-processed on every call. Prompt caching lets the provider reuse it, cutting first-token time and cost by half or more.',
  docs: [docs.caching],
  steps: ["Mark the stable prefix as cacheable (cache_control: { type: 'ephemeral' } on Anthropic; prefix caching is automatic on OpenAI when the prefix is stable)", 'Put the stable part first and the changing part last'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const ttft = pageMetric(pages, 'aiFirstTokenMs') ?? 2400
    for (const file of aiFiles(scan.files)) {
      let lastHit = -100
      for (const line of callLines(file)) {
        if (line - lastHit < 12) continue
        const win = snippet(file, line, 12)
        const usesSystem = /system\s*:/.test(win) || /role:\s*['"]system['"]/.test(win)
        const bigPrompt = /\b[A-Z][A-Z0-9_]*(PROMPT|GUIDE|INSTRUCTIONS|DOCS|CONTEXT|KNOWLEDGE)\b|readFile|\.md['"]/.test(win) || /`[^`]{800,}`/.test(file.text)
        if (!usesSystem || !bigPrompt || /cache_control|cacheControl|prompt_cache|promptCache/.test(win)) continue
        lastHit = line
        out.push({
          location: loc(file, line),
          chain: { metric: 'aiFirstTokenMs', value: ttft, cost: { label: 'system prompt ~9,800 tokens', detail: 'sent uncached on every call' }, code: { snippet: lineText(file, line), location: loc(file, line) } },
          gain: { from: ttft, to: Math.max(500, ttft * 0.45), scoreDelta: 0, note: 'cost per message −50–60%' },
          changes: [replaceLine(file, line, lineText(file, line).replace(/system:\s*([^,}]+)/, "system: [{ type: 'text', text: $1, cache_control: { type: 'ephemeral' } }]"))],
          automatic: false,
          confidence: 0.7,
          prevent: { metric: 'aiCacheHitRate', max: 0.7 },
        })
      }
    }
    return out
  },
})

export const oversizedContext = base({
  id: 'ai/oversized-context',
  title: 'Whole files or history sent to the AI',
  plain: 'Far more text than needed is sent with every question',
  severity: 'warning',
  metrics: ['aiCostUsd', 'aiFirstTokenMs'],
  why: 'Sending entire files or the complete chat history every time grows tokens, cost and latency. Retrieve only what the question needs and summarise old history.',
  docs: [docs.caching],
  steps: ['Trim history to the last N turns and a summary', 'Retrieve relevant chunks instead of whole documents'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /(messages|history|conversation)\s*:\s*(messages|history|conversation|allMessages)\b|readFileSync|readFile\(|JSON\.stringify\((data|rows|records|items)\)/.test(snippet(file, line, 8)) && !/slice\(|summar/i.test(snippet(file, line, 8)), 'aiCostUsd', (v) => ({ to: v * 0.5, scoreDelta: 0 }), { confidence: 0.6 }),
})

export const modelOverkill = base({
  id: 'ai/model-overkill',
  title: 'Biggest model used for a simple task',
  plain: 'An expensive AI model does a job a small one could do',
  severity: 'warning',
  metrics: ['aiCostUsd', 'aiFirstTokenMs'],
  why: 'Classification, extraction and short labels do not need the largest model. A smaller model is several times cheaper and faster with the same result.',
  docs: [{ label: 'Anthropic: Choosing a model', url: 'https://docs.anthropic.com/en/docs/about-claude/models' }],
  steps: ['Route simple tasks to a small, fast model', 'Keep the big model for reasoning-heavy tasks'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => BIG_MODEL.test(snippet(file, line, 6)) && SIMPLE_TASK.test(snippet(file, line, 12)), 'aiCostUsd', (v) => ({ to: v * 0.2, scoreDelta: 0 }), { confidence: 0.6 }),
})

export const missingMaxTokens = base({
  id: 'ai/missing-max-tokens',
  title: 'No output limit on an AI call',
  plain: 'An AI answer can grow without limit and run up cost',
  severity: 'info',
  metrics: ['aiCostUsd'],
  why: 'Without max_tokens a runaway answer can cost many times more than planned and take much longer.',
  docs: [docs.structured],
  steps: ['Set max_tokens / maxOutputTokens to what the UI can show'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /chat\.completions\.create|generateText\(|generateContent\(/.test(lineText(file, line)) && !/max_tokens|maxTokens|max_completion_tokens|maxOutputTokens/.test(snippet(file, line, 10)), 'aiCostUsd', (v) => ({ to: v, scoreDelta: 0 }), { confidence: 0.7 }),
})

export const noRetryBackoff = base({
  id: 'ai/no-retry-backoff',
  title: 'Instant retry on AI errors',
  plain: 'When the AI is busy the app retries immediately and gets blocked more',
  severity: 'warning',
  metrics: ['aiErrorRate'],
  why: 'Retrying at once after a 429 / overloaded error makes rate limiting worse. Exponential backoff with jitter, honouring retry-after, succeeds far more often.',
  docs: [docs.caching],
  steps: ['Wait 2^attempt seconds plus jitter before retrying', 'Respect the retry-after header', 'Cap the attempts and fall back to a smaller model or a message'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /catch\s*\(/.test(snippet(file, line, 10)) && /retry|attempt/i.test(snippet(file, line, 10)) && !/setTimeout|sleep|delay|backoff|\*\*/.test(snippet(file, line, 12)), 'aiErrorRate', (v) => ({ to: v * 0.3, scoreDelta: 0 }), { confidence: 0.6 }),
})

export const noTimeout = base({
  id: 'ai/no-timeout',
  title: 'AI call without a timeout',
  plain: 'If the AI hangs, the user waits forever',
  severity: 'warning',
  metrics: ['aiErrorRate', 'aiFirstTokenMs'],
  why: 'Provider calls occasionally hang. Without a timeout the request, and the UI, never recovers.',
  docs: [docs.streaming],
  steps: ['Pass a timeout / AbortSignal.timeout(30_000)', 'Show a fallback message when it fires'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /new (OpenAI|Anthropic|GoogleGenAI|GoogleGenerativeAI)\(/.test(lineText(file, line)) && !/timeout|AbortSignal|signal/.test(snippet(file, line, 6)), 'aiErrorRate', (v) => ({ to: v, scoreDelta: 0 }), { confidence: 0.6 }),
})

export const noSemanticCache = base({
  id: 'ai/no-semantic-cache',
  title: 'Repeated questions answered from scratch',
  plain: 'The same question costs a full AI call every time it is asked',
  severity: 'info',
  metrics: ['aiCostUsd', 'aiFirstTokenMs'],
  why: 'FAQ-style questions repeat. Caching answers by normalised question (or embedding similarity) returns them instantly and for free.',
  docs: [docs.caching],
  steps: ['Hash the normalised question and cache the answer', 'For similar questions compare embeddings above a threshold'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file) => /faq|support|help|qa\b|question/i.test(file.path) && !/cache|memo|redis|kv\./i.test(file.text), 'aiCostUsd', (v) => ({ to: v * 0.6, scoreDelta: 0 }), { confidence: 0.5 }),
})

export const embedInLoop = base({
  id: 'ai/embed-in-loop',
  title: 'Embeddings created one by one',
  plain: 'Documents are converted for search one at a time instead of in batches',
  severity: 'warning',
  metrics: ['aiFirstTokenMs', 'aiCostUsd'],
  why: 'Embedding APIs accept many inputs per call. One call per item multiplies latency and overhead.',
  docs: [docs.batch],
  steps: ['Collect inputs and embed them in batches of 50–100', 'Run batches in parallel with a concurrency limit'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const ttft = pageMetric(pages, 'aiFirstTokenMs') ?? 2400
    for (const file of aiFiles(scan.files)) {
      for (const fn of file.functions) {
        const hit = fn.awaits.find((a) => a.inLoop && EMBED.test(a.callee))
        if (!hit) continue
        out.push({ location: loc(file, hit.line, fn.name), chain: { metric: 'aiFirstTokenMs', value: ttft, cost: { label: 'one embedding call per item', detail: `in ${fn.name}()` }, code: { snippet: snippet(file, hit.line, 2), location: loc(file, hit.line) } }, gain: { from: ttft, to: ttft * 0.4, scoreDelta: 0 }, automatic: false })
      }
    }
    return out
  },
})

export const unstructuredParse = base({
  id: 'ai/unstructured-parse',
  title: 'AI answer parsed with regex',
  plain: 'The app guesses the AI answer format instead of asking for structured data',
  severity: 'info',
  metrics: ['aiErrorRate'],
  why: 'Free-text parsing breaks whenever the model phrases things differently, causing retries and errors. Structured outputs / tool schemas return exact JSON.',
  docs: [docs.structured],
  steps: ['Define a JSON schema or tool for the answer', 'Validate it with zod'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /JSON\.parse\(.*(content|text|message)|\.match\(\/|\.split\(['"]\\n/.test(snippet(file, line, 10)) && !/tools?:|response_format|responseSchema|json_schema/.test(snippet(file, line, 12)), 'aiErrorRate', (v) => ({ to: v * 0.5, scoreDelta: 0 }), { confidence: 0.55 }),
})

export const hugeToolList = base({
  id: 'ai/huge-tool-list',
  title: 'Dozens of tool definitions on every call',
  plain: 'Every AI request carries a long list of tools it will not use',
  severity: 'info',
  metrics: ['aiCostUsd', 'aiFirstTokenMs'],
  why: 'Tool definitions count as input tokens on every call and make tool choice worse. Load only the tools relevant to the task.',
  docs: [docs.structured],
  steps: ['Group tools by task and pass only the relevant group', 'Use tool search / deferred loading'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /tools\s*:\s*(ALL_TOOLS|allTools|tools)\b/.test(snippet(file, line, 6)) && (file.text.match(/name:\s*['"][a-z_]+['"]/g)?.length ?? 0) > 20, 'aiCostUsd', (v) => ({ to: v * 0.7, scoreDelta: 0 }), { confidence: 0.55 }),
})

export const agentLoop = base({
  id: 'ai/agent-loop',
  title: 'Agent loop without a step limit',
  plain: 'An AI agent can repeat itself forever and keep spending',
  severity: 'warning',
  metrics: ['aiCostUsd'],
  why: 'A while(true) agent loop with no maximum steps or loop detection can repeat the same tool call endlessly.',
  docs: [docs.structured],
  steps: ['Add a maximum number of steps', 'Stop when the same tool call repeats with the same input'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(snippet(file, line, 15)) && !/maxSteps|max_steps|MAX_STEPS|steps\s*[<>]|attempt/i.test(snippet(file, line, 15)), 'aiCostUsd', (v) => ({ to: v * 0.5, scoreDelta: 0 }), { confidence: 0.65 }),
})

export const clientSideKey = base({
  id: 'ai/client-side-key',
  title: 'AI API key used in browser code',
  plain: 'Your AI key is visible to anyone who opens the site',
  severity: 'critical',
  metrics: ['aiCostUsd'],
  areas: ['ai', 'security'],
  why: 'Anything in browser code is public. A key there can be copied and used by strangers, at your cost.',
  docs: [docs.keys],
  steps: ['Move the AI call to a server route', 'Rotate the exposed key now', 'Never prefix secrets with NEXT_PUBLIC_ / VITE_'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /dangerouslyAllowBrowser|NEXT_PUBLIC_\w*(KEY|SECRET)|VITE_\w*(KEY|SECRET)|import\.meta\.env\.\w*KEY/.test(snippet(file, line, 6)) || (/apiKey\s*:\s*['"]sk-/.test(lineText(file, line))), 'aiCostUsd', (v) => ({ to: v, scoreDelta: 0 }), { confidence: 0.9, severity: 'critical' }),
})

export const noBatchForOffline = base({
  id: 'ai/no-batch-for-offline',
  title: 'Offline job sends requests one by one',
  plain: 'A background job pays full price for thousands of AI calls that could run as a batch',
  severity: 'info',
  metrics: ['aiCostUsd'],
  why: 'Batch APIs cost about half as much for work that does not need an instant answer (nightly jobs, back-fills).',
  docs: [docs.batch],
  steps: ['Collect the requests and submit them to the batch API', 'Poll for results'],
  detect: ({ scan, pages }) => findCalls(scan, pages, (file, line) => /cron|job|worker|script|batch|backfill|nightly/i.test(file.path) && /for\s*\(|\.map\(|forEach/.test(snippet(file, line, 8)) && !/batches\.create|batch/i.test(snippet(file, line, 8)), 'aiCostUsd', (v) => ({ to: v * 0.5, scoreDelta: 0 }), { confidence: 0.55 }),
})

function findCalls(scan: Parameters<Rule['detect']>[0]['scan'], pages: Parameters<Rule['detect']>[0]['pages'], test: (file: SourceFile, line: number) => boolean, metric: 'aiFirstTokenMs' | 'aiCostUsd' | 'aiErrorRate', gain: (v: number) => { to: number; scoreDelta: number }, extra: Partial<Finding> = {}): Finding[] {
  const out: Finding[] = []
  if (!scan) return out
  const value = pageMetric(pages, metric) ?? (metric === 'aiFirstTokenMs' ? 2400 : metric === 'aiCostUsd' ? 0.011 : 0.04)
  for (const file of aiFiles(scan.files)) {
    let lastHit = -100
    for (const line of callLines(file)) {
      if (line - lastHit < 8 || !test(file, line)) continue
      lastHit = line
      out.push({ location: loc(file, line), chain: { metric, value, code: { snippet: lineText(file, line), location: loc(file, line) } }, gain: { from: value, ...gain(value) }, ...extra })
    }
  }
  return out
}

export const aiRules: Rule[] = [sequentialAwait, noStreaming, noPromptCache, oversizedContext, modelOverkill, missingMaxTokens, noRetryBackoff, noTimeout, noSemanticCache, embedInLoop, unstructuredParse, hugeToolList, agentLoop, clientSideKey, noBatchForOffline]
