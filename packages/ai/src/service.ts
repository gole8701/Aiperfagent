import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import type { AiService, ModelComparison, ProviderStatus, ReportStore } from '@perfagent/engine'
import { redactText } from '@perfagent/security'

import { createKeyStore, maskKey, type KeyStore } from './keys.js'
import { estimateCostUsd } from './prices.js'
import {
  explainPrompt,
  fixPrompt,
  parseProposedChanges,
  repairPrompt,
  summaryPrompt,
  SYSTEM_PROMPT,
} from './prompts.js'
import {
  OLLAMA_INSTALL_HINT,
  OLLAMA_URL,
  ollamaModels,
  PROVIDERS,
  providerById,
  type ChatMessage,
  type ChatResult,
  type Provider,
  type ProviderAuth,
  type ProviderId,
} from './providers/index.js'
import { buildAiReport } from './report.js'
import { UsageLedger } from './usage.js'

const run = promisify(execFile)

export interface AiServiceOptions {
  config: PerfAgentConfig
  store: ReportStore
  /** Where keys are kept; tests point this at a temp folder with the file store. */
  keyStore?: KeyStore
}

const MAX_TOKENS = { explain: 1200, fix: 4000, summary: 800, compare: 600 }

/** Bring-your-own AI: the user's provider, the user's key, the user's budget. Rules stay the free default. */
export function createAiService(options: AiServiceOptions): AiService {
  const { config, store } = options
  const keys = options.keyStore ?? createKeyStore()
  const ledger = new UsageLedger(store, config.ai)

  async function auth(id: ProviderId): Promise<ProviderAuth> {
    const stored = await keys.read(id)
    return {
      apiKey: stored?.key,
      baseUrl: id === config.ai.provider ? config.ai.baseUrl : undefined,
    }
  }

  async function active(): Promise<{ provider: Provider; model: string } | undefined> {
    const id = config.ai.provider
    if (id !== 'none' && id !== 'browser') {
      const provider = providerById(id)
      if (provider) return { provider, model: config.ai.model || (await defaultModel(provider)) }
    }
    if (id === 'none') {
      const models = await ollamaModels()
      const model = models?.find((m) => m.startsWith('qwen2.5-coder')) ?? models?.[0]
      if (model) return { provider: PROVIDERS.ollama, model }
    }
    return undefined
  }

  async function defaultModel(provider: Provider): Promise<string> {
    if (provider.id !== 'ollama') return provider.defaultModel
    const models = await ollamaModels(config.ai.baseUrl)
    return (
      models?.find((m) => m.startsWith('qwen2.5-coder')) ?? models?.[0] ?? provider.defaultModel
    )
  }

  function requireAi(): Promise<{ provider: Provider; model: string }> {
    return active().then((a) => {
      if (a) return a
      throw new PerfAgentError(
        'AI_NOT_CONFIGURED',
        'No AI is connected.',
        'Install the free local AI or add a key in Profile → AI connections. The built-in rules still find and fix known problems.',
      )
    })
  }

  /** Every call goes through here: redaction → budget check → provider → ledger/audit. */
  async function chat(
    target: { provider: Provider; model: string },
    purpose: keyof typeof MAX_TOKENS,
    messages: ChatMessage[],
    files: number,
    spentUsd = 0,
  ): Promise<ChatResult> {
    const clean = config.ai.redact
      ? messages.map((m) => ({ ...m, content: redactText(m.content) }))
      : messages
    const chars = clean.reduce((n, m) => n + m.content.length, SYSTEM_PROMPT.length)
    await ledger.assertBudget(
      target.provider.id,
      target.model,
      chars,
      MAX_TOKENS[purpose],
      purpose,
      spentUsd,
    )
    const result = await target.provider.chat(
      {
        system: SYSTEM_PROMPT,
        messages: clean,
        maxTokens: MAX_TOKENS[purpose],
        model: target.model,
        stream: true,
      },
      await auth(target.provider.id),
    )
    await ledger.record(target.provider.id, result, purpose, files)
    return result
  }

  return {
    async providers(): Promise<ProviderStatus[]> {
      const out: ProviderStatus[] = [await ollamaStatus(config.ai.baseUrl)]
      for (const id of ['anthropic', 'openai', 'openai-compatible', 'gemini'] as const) {
        const provider = PROVIDERS[id]
        const stored = await keys.read(id)
        const endpoint = id === config.ai.provider ? config.ai.baseUrl : undefined
        const configured = Boolean(stored) || (id === 'openai-compatible' && Boolean(endpoint))
        const detail = stored
          ? stored.source === 'env'
            ? 'from environment'
            : stored.source === 'file'
              ? `key ${maskKey(stored.key)} · stored in ~/.perfagent/keys.json (no OS keychain found; file is readable only by you)`
              : `key ${maskKey(stored.key)} · stored in OS keychain`
          : endpoint
            ? `endpoint ${endpoint}`
            : undefined
        out.push({ id, label: provider.label, free: false, configured, detail, models: [] })
      }
      out.push({
        id: 'browser',
        label: 'In-browser AI (WebGPU)',
        free: true,
        configured: false,
        detail: 'handled in the dashboard',
        models: [],
      })
      return out
    },

    async testConnection(id, opts = {}) {
      const provider = providerById(id)
      if (!provider)
        return {
          ok: false,
          message: 'The in-browser AI is tested from the dashboard itself.',
          latencyMs: 0,
        }
      const a = await auth(id)
      return provider.test(
        { ...a, baseUrl: opts.baseUrl ?? a.baseUrl },
        opts.model === '' ? undefined : opts.model,
      )
    },

    async storeKey(id, key) {
      if (!providerById(id))
        throw new PerfAgentError('IMPORT_INVALID', 'This provider has no API key')
      await keys.store(id, key.trim())
    },

    removeKey: (id) => keys.remove(id),

    async explain(issue, files) {
      const target = await requireAi()
      const result = await chat(
        target,
        'explain',
        [{ role: 'user', content: explainPrompt(issue, files) }],
        files.length,
      )
      return result.text.trim()
    },

    async proposeFix(issues, files, instructions) {
      const target = await requireAi()
      if (!files.length) return []
      const messages: ChatMessage[] = [
        { role: 'user', content: fixPrompt(issues, files, instructions) },
      ]
      const first = await chat(target, 'fix', messages, files.length)
      const parsed = parseProposedChanges(first.text, files)
      if (parsed) return parsed
      // One repair pass: small models often wrap the JSON in prose.
      const spent = estimateCostUsd(
        first.model,
        first.inputTokens,
        first.outputTokens,
        first.cachedTokens,
        target.provider.id,
      )
      const second = await chat(
        target,
        'fix',
        [
          ...messages,
          { role: 'assistant', content: first.text },
          { role: 'user', content: repairPrompt() },
        ],
        files.length,
        spent,
      )
      return parseProposedChanges(second.text, files) ?? []
    },

    async summarise(report) {
      const target = await requireAi()
      return (
        await chat(target, 'summary', [{ role: 'user', content: summaryPrompt(report) }], 0)
      ).text.trim()
    },

    usage: () => ledger.summary(),

    async activeProvider() {
      return (await active())?.provider.id ?? 'rules'
    },

    report: () =>
      buildAiReport(path.join(store.dir, 'ai-samples.jsonl'), {
        budgetUsdPerDay: config.ai.budgetUsdPerDay,
      }),

    async compareModels(questions, models) {
      if (models.length < 2)
        throw new PerfAgentError('IMPORT_INVALID', 'Pick at least two models to compare')
      const rows: ModelComparison[] = []
      for (const m of models) {
        const provider = providerById(m.provider)
        if (!provider) continue
        for (const question of questions) {
          const row: ModelComparison = {
            provider: m.provider,
            model: m.model,
            question,
            firstTokenMs: 0,
            totalMs: 0,
            outputTokens: 0,
            costUsd: 0,
            qualityScore: 0,
            answer: '',
          }
          try {
            const result = await chat(
              { provider, model: m.model },
              'compare',
              [{ role: 'user', content: question }],
              0,
            )
            const costUsd = estimateCostUsd(
              result.model,
              result.inputTokens,
              result.outputTokens,
              result.cachedTokens,
              m.provider,
            )
            Object.assign(row, {
              firstTokenMs: result.firstTokenMs,
              totalMs: result.totalMs,
              outputTokens: result.outputTokens,
              answer: result.text.trim(),
              qualityScore: lengthSanity(result.text),
              costUsd,
            })
          } catch (error) {
            row.error = error instanceof Error ? error.message : String(error)
          }
          rows.push(row)
        }
      }
      return rows
    },
  }
}

/** Quality placeholder until thumbs-up ratings exist: 1 for a reasonable length, less for empty or runaway answers. */
function lengthSanity(text: string): number {
  const n = text.trim().length
  if (n === 0) return 0
  if (n < 20) return 0.3
  if (n > 6000) return 0.5
  return 1
}

async function ollamaStatus(baseUrl: string | undefined): Promise<ProviderStatus> {
  const models = await ollamaModels(baseUrl ?? OLLAMA_URL)
  if (models)
    return {
      id: 'ollama',
      label: PROVIDERS.ollama.label,
      free: true,
      configured: models.length > 0,
      detail: models.length
        ? `running · ${models.length} model${models.length === 1 ? '' : 's'}`
        : 'running · no models yet',
      models,
      installHint: models.length ? undefined : OLLAMA_INSTALL_HINT,
    }
  const installed = await run('ollama', ['--version'], { timeout: 3000 }).then(
    () => true,
    () => false,
  )
  return {
    id: 'ollama',
    label: PROVIDERS.ollama.label,
    free: true,
    configured: false,
    detail: installed ? 'installed, not running (run "ollama serve")' : 'not installed',
    models: [],
    installHint: OLLAMA_INSTALL_HINT,
  }
}
