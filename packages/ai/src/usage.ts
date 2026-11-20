import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import type { AiUsage, ReportStore } from '@perfagent/engine'

import { estimateCostUsd, priceFor } from './prices.js'
import type { ChatResult, ProviderId } from './providers/types.js'

const USAGE_FILE = 'ai-usage.json'
const MAX_ENTRIES = 5000

export interface UsageEntry {
  at: string
  provider: ProviderId
  model: string
  purpose: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  costUsd: number
  totalMs: number
}

interface UsageFile {
  entries: UsageEntry[]
}

/** Per-call cost ledger in `.perfagent/ai-usage.json`, budget checks and the audit log. Never stores prompt content. */
export class UsageLedger {
  constructor(private readonly store: ReportStore, private readonly config: PerfAgentConfig['ai']) {}

  async summary(): Promise<AiUsage> {
    const entries = await this.entries()
    const month = new Date().toISOString().slice(0, 7)
    const thisMonth = entries.filter((e) => e.at.startsWith(month))
    return { monthUsd: round(thisMonth.reduce((s, e) => s + e.costUsd, 0)), calls: entries.length, lastAt: entries[entries.length - 1]?.at }
  }

  /**
   * Refuses before the call when the worst case (all input + maxTokens output)
   * would exceed the monthly budget, or the per-fix limit for fixes.
   */
  async assertBudget(provider: ProviderId, model: string, inputChars: number, maxTokens: number, purpose: string, spentThisRunUsd = 0): Promise<void> {
    if (provider === 'ollama' || provider === 'browser' || !priceFor(model)) return
    const worst = estimateCostUsd(model, Math.ceil(inputChars / 4), maxTokens, 0, provider)
    const { monthUsd } = await this.summary()
    if (this.config.monthlyBudgetUsd > 0 && monthUsd + worst > this.config.monthlyBudgetUsd) {
      throw new PerfAgentError('AI_BUDGET_EXCEEDED', `This call could cost $${worst.toFixed(3)} and the monthly AI budget ($${this.config.monthlyBudgetUsd}) is nearly used ($${monthUsd.toFixed(2)}).`, 'Raise ai.monthlyBudgetUsd in Profile → Limits, or use the free local AI.')
    }
    if (purpose === 'fix' && this.config.maxPerFixUsd > 0 && spentThisRunUsd + worst > this.config.maxPerFixUsd) {
      throw new PerfAgentError('AI_BUDGET_EXCEEDED', `This fix could cost $${worst.toFixed(3)}, over the per-fix limit of $${this.config.maxPerFixUsd}.`, 'Raise ai.maxPerFixUsd or send less code (ai.sendCode = snippets).')
    }
  }

  async record(provider: ProviderId, result: ChatResult, purpose: string, files: number): Promise<UsageEntry> {
    const entry: UsageEntry = {
      at: new Date().toISOString(),
      provider,
      model: result.model,
      purpose,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      costUsd: round(estimateCostUsd(result.model, result.inputTokens, result.outputTokens, result.cachedTokens, provider)),
      totalMs: result.totalMs,
    }
    const entries = [...(await this.entries()), entry].slice(-MAX_ENTRIES)
    await this.store.writeJson(USAGE_FILE, { entries } satisfies UsageFile)
    if (this.config.auditLog) {
      await this.store.appendLog('audit.log', `ai ${purpose} provider=${provider} model=${result.model} in=${result.inputTokens} out=${result.outputTokens} cached=${result.cachedTokens} cost=${entry.costUsd} files=${files}`)
    }
    return entry
  }

  private async entries(): Promise<UsageEntry[]> {
    const file = await this.store.readJson<UsageFile>(USAGE_FILE, { entries: [] })
    return Array.isArray(file.entries) ? file.entries : []
  }
}

function round(usd: number): number {
  return Math.round(usd * 1_000_000) / 1_000_000
}
