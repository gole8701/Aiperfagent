---
title: Connect your AI (key or free)
group: Fix & connect
summary: Use your own Anthropic, OpenAI, Gemini or OpenAI-compatible key, a company endpoint, or free local Ollama. Keys stay in your OS keychain.
order: 25
tryIt: /settings/ai
---

## What it is

Connecting an AI tells PerfAgent which model may write explanations and code fixes for you, paid with your own key or free on your own machine.

PerfAgent ships with no API keys and no AI server. Without a connection it still finds problems and gives built-in fixes with the rule engine. With a connection it can explain a problem in your words, summarise a report and propose deeper fixes.

## Why it matters

You keep control of cost and privacy: your key, your tokens, your choice of how much code leaves the machine. Teams can point PerfAgent at a company endpoint that already has the right contracts.

## Use case

- Free, offline: Ollama with a coding model.
- A personal Anthropic or OpenAI key for better fixes.
- A company gateway (Azure OpenAI, an internal proxy) through `baseUrl`.

## How it helps your app

Better fixes for the harder problems: splitting a context, restructuring an effect, parallelising a RAG pipeline. The built-in fixes cover the mechanical cases; the AI covers the rest.

## How to do it in PerfAgent, step by step

1. **Settings:** open **Settings → AI**. The provider list shows Ollama (free), Anthropic, OpenAI, OpenAI-compatible, Gemini and in-browser AI, with what is configured.
2. **Settings:** for Ollama press **Install hint** if it is not running, then pick a model such as `qwen2.5-coder`.
3. **Settings:** for a paid provider paste the key. It is stored in the OS keychain (on Windows, an encrypted private file in `~/.perfagent`), never in `perfagent.config.ts` or the project's `.perfagent/`.
4. **Settings:** press **Test connection**; it reports ok, a message and the latency.
5. **Settings:** set `sendCode` (`snippets`, `files` or `none`), `monthlyBudgetUsd` and `maxPerFixUsd`, and keep `redact` and `auditLog` on.

## Commands & config

```ts
export default defineConfig({
  ai: {
    provider: 'ollama', // 'none' | 'ollama' | 'anthropic' | 'openai' | 'openai-compatible' | 'gemini' | 'browser'
    model: 'qwen2.5-coder', // empty picks the provider default
    baseUrl: undefined, // OpenAI-compatible, Azure or company proxy
    sendCode: 'snippets', // 'snippets' | 'files' | 'none'
    monthlyBudgetUsd: 20,
    maxPerFixUsd: 0.2,
    redact: true,
    auditLog: true,
  },
})
```

```bash
# Free local model
brew install ollama        # or https://ollama.com/download
ollama pull qwen2.5-coder
ollama serve
```

## Expert detail

- Routes: `GET /api/ai/providers` (statuses, active provider, month usage, `ai` config), `POST /api/ai/test { provider, model?, baseUrl? }`, `POST /api/ai/keys { provider, key }` (minimum 8 characters, writes an audit line), `DELETE /api/ai/keys/:provider`, `POST /api/ai/explain { reportId?, issueId }`, `POST /api/ai/summary`, `POST /api/ai/suggest { issueIds }` (text only, applies nothing; available in every mode).
- `activeProvider()` returns `'rules'` when nothing is connected: the free built-in engine answers.
- Keys are read from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` first, then from the OS keychain (macOS Keychain via `security`, libsecret via `secret-tool` on Linux). On Windows, or on Linux without `secret-tool`, they go to `~/.perfagent/keys.json`, encrypted with AES-256-GCM under a random 32-byte per-machine secret in `~/.perfagent/.keysecret` (created on first use); both files are mode 0600. This stops a copied or backed-up `keys.json` from leaking keys, but anyone who can read both files as you can decrypt them. A plaintext `keys.json` from an older version is encrypted the first time it is read. The dashboard shows them masked (`••••3f9`). They travel only to the provider they belong to.
- `sendCode: 'snippets'` sends the lines around each problem; `'files'` sends whole files; `'none'` sends only the problem description. Everything passes through `redact` first (API keys, tokens, JWTs, emails, private keys, password-like values).
- The CSP `connect-src` of the dashboard allows the local server and localhost ports (Ollama runs on `127.0.0.1:11434`); provider APIs are called from the server, not from the browser, except the in-browser AI option.
- Page and file content sent to the AI is treated as data, never instructions; the AI has no tools that write files, run commands or call the network.
- Default models when `ai.model` is empty: Anthropic `claude-sonnet-4-5`, OpenAI `gpt-4.1-mini`, Gemini `gemini-2.5-flash`, Ollama `qwen2.5-coder:7b`; OpenAI-compatible needs a model. The in-browser AI (WebGPU) runs in the dashboard, not the server.
- Spending limits are enforced before each call: `ai.monthlyBudgetUsd` and, for fixes, `ai.maxPerFixUsd` (`AI_BUDGET_EXCEEDED` when a call could go over).

## Walkthrough

```walkthrough
[
  { "screen": "settings", "area": "provider-list", "title": "Providers", "text": "Ollama (free), Anthropic, OpenAI, OpenAI-compatible, Gemini, in-browser." },
  { "screen": "settings", "area": "key-field", "title": "Paste a key", "text": "Stored in your OS keychain, shown masked, never in your project." },
  { "screen": "settings", "area": "test-connection", "title": "Test", "text": "One call confirms the model answers and shows the latency." },
  { "screen": "settings", "area": "limits", "title": "Limits and privacy", "text": "sendCode, monthly budget, per-fix cap, redaction and audit log." }
]
```

## Learn more

- [Ollama](https://ollama.com)
- [Anthropic: Get started](https://docs.anthropic.com/en/docs/get-started)
- [OpenAI: API keys](https://platform.openai.com/docs/api-reference/authentication)
- [Google AI: Gemini API](https://ai.google.dev/gemini-api/docs)
