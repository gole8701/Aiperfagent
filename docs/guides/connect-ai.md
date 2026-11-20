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

1. **Settings:** open **Settings → AI connections**. It has three groups: **Free · no key**, **Use the AI you already pay for · no key** and **Cloud AI**.
2. **Free · no key:** if Ollama is running without a model, pick one and press **Download free model** (progress bar; `qwen2.5-coder:1.5b` is 1 GB). If it is not installed, press **Install free local AI** for the command. LM Studio is picked up automatically when its local server runs on port 1234.
3. **Use the AI you already pay for:** if Claude Code, Codex CLI or Gemini CLI is installed and signed in, it shows **Use it**. PerfAgent then asks that tool, so it uses your own plan and you never paste a key. Not installed? **How to get it** shows the install command.
4. **Cloud AI:** press **Connect with OpenRouter**, sign in on OpenRouter and you come back connected (one login, hundreds of models, billed to your OpenRouter account). To paste a key for Anthropic, OpenAI, Gemini or a company endpoint instead, open **Advanced: paste an API key**. Keys go to the OS keychain (on Windows, an encrypted private file in `~/.perfagent`), never to `perfagent.config.ts` or the project's `.perfagent/`.
5. **Settings:** press **Test** on any row; it reports ok, a message and the latency. Then set `sendCode` (`snippets`, `files` or `none`), `monthlyBudgetUsd` and `maxPerFixUsd`, and keep `redact` and `auditLog` on.

## Commands & config

```ts
export default defineConfig({
  ai: {
    provider: 'ollama', // 'none' | 'ollama' | 'lmstudio' | 'claude-code' | 'codex' | 'gemini-cli' | 'openrouter' | 'anthropic' | 'openai' | 'openai-compatible' | 'gemini' | 'browser'
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
- Signed-in tools: PerfAgent runs `claude -p --tools "" --strict-mcp-config --no-session-persistence --output-format json`, `codex exec --sandbox read-only` or `gemini -p` with a fixed argument list (no shell), the prompt on stdin, inside a new empty temp folder that is deleted afterwards. Built-in file and command tools are off where the CLI allows it, so the tool only sees the text PerfAgent sends. Their status comes from `<tool> --version`.
- OpenRouter login uses PKCE: the dashboard sends you to `openrouter.ai/auth` with a SHA-256 challenge, and the one-time code that comes back is swapped on the server (`POST /api/ai/openrouter { code, verifier }`) for a key in your own OpenRouter account, stored like any other key. `OPENROUTER_API_KEY` also works.
- `POST /api/ai/pull { model }` downloads an Ollama model; progress arrives over the WebSocket as `ai:pull` messages.
- `activeProvider()` returns `'rules'` when nothing is connected: the free built-in engine answers.
- Keys are read from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` first, then from the OS keychain (macOS Keychain via `security`, libsecret via `secret-tool` on Linux). On Windows, or on Linux without `secret-tool`, they go to `~/.perfagent/keys.json`, encrypted with AES-256-GCM under a random 32-byte per-machine secret in `~/.perfagent/.keysecret` (created on first use); both files are mode 0600. This stops a copied or backed-up `keys.json` from leaking keys, but anyone who can read both files as you can decrypt them. A plaintext `keys.json` from an older version is encrypted the first time it is read. The dashboard shows them masked (`••••3f9`). They travel only to the provider they belong to.
- `sendCode: 'snippets'` sends the lines around each problem; `'files'` sends whole files; `'none'` sends only the problem description. Everything passes through `redact` first (API keys, tokens, JWTs, emails, private keys, password-like values).
- The CSP `connect-src` of the dashboard allows the local server and localhost ports (Ollama runs on `127.0.0.1:11434`); provider APIs are called from the server, not from the browser, except the in-browser AI option.
- Page and file content sent to the AI is treated as data, never instructions; the AI has no tools that write files, run commands or call the network.
- Default models when `ai.model` is empty: Anthropic `claude-sonnet-4-5`, OpenAI `gpt-4.1-mini`, Gemini `gemini-2.5-flash`, Ollama `qwen2.5-coder:7b`; OpenAI-compatible needs a model. The in-browser AI (WebGPU) runs in the dashboard, not the server.
- Spending limits are enforced before each call: `ai.monthlyBudgetUsd` and, for fixes, `ai.maxPerFixUsd` (`AI_BUDGET_EXCEEDED` when a call could go over).

## Learn more

- [Ollama](https://ollama.com)
- [Anthropic: Get started](https://docs.anthropic.com/en/docs/get-started)
- [OpenAI: API keys](https://platform.openai.com/docs/api-reference/authentication)
- [Google AI: Gemini API](https://ai.google.dev/gemini-api/docs)
