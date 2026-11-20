import { PerfAgentError } from '@perfagent/core'
import { gatherContext, type ProviderStatus } from '@perfagent/engine'

import type { AppContext } from '../app.js'
import { currentLaunch, mcpClients, MCP_CONFIGS } from '../mcp-clients.js'
import type { Router } from '../router.js'

export function aiRoutes(router: Router, ctx: AppContext): void {
  const ai = (): NonNullable<AppContext['ai']> => {
    if (!ctx.ai)
      throw new PerfAgentError('AI_NOT_CONFIGURED', 'AI features are not available in this build')
    return ctx.ai
  }

  router.get('/api/ai/providers', async () => ({
    providers: await ai().providers(),
    active: await ai().activeProvider(),
    usage: await ai().usage(),
    config: ctx.config.ai,
  }))
  router.post('/api/ai/test', async ({ json }) => {
    const body = await json<{ provider: ProviderStatus['id']; model?: string; baseUrl?: string }>()
    return ai().testConnection(body.provider, { model: body.model, baseUrl: body.baseUrl })
  })
  router.post('/api/ai/keys', async ({ json }) => {
    const { provider, key } = await json<{ provider: ProviderStatus['id']; key: string }>()
    if (!key || key.length < 8) throw new PerfAgentError('IMPORT_INVALID', 'Paste the full key')
    await ai().storeKey(provider, key)
    await ctx.store.appendLog('audit.log', `key stored for ${provider}`)
  })
  router.delete('/api/ai/keys/:provider', async ({ params }) => {
    await ai().removeKey(params.provider as ProviderStatus['id'])
  })

  router.post('/api/ai/explain', async ({ json }) => {
    const { reportId, issueId } = await json<{ reportId?: string; issueId: string }>()
    const report = reportId ? await ctx.store.get(reportId) : await ctx.store.latest()
    const issue = report?.issues.find((i) => i.id === issueId)
    if (!issue) throw new PerfAgentError('NOT_FOUND', 'Problem not found')
    const files =
      ctx.mode.mode === 'local'
        ? await gatherContext(ctx.config.root, [issue], ctx.config.ai.sendCode)
        : []
    await ctx.store.appendLog(
      'audit.log',
      `explain ${issue.id} via ${await ai().activeProvider()} (${files.length} snippets)`,
    )
    return { text: await ai().explain(issue, files) }
  })

  router.post('/api/ai/summary', async ({ json }) => {
    const { reportId } = await json<{ reportId?: string }>()
    const report = reportId ? await ctx.store.get(reportId) : await ctx.store.latest()
    if (!report) throw new PerfAgentError('NOT_FOUND', 'No report')
    return { text: await ai().summarise(report) }
  })

  /** Suggest-only everywhere: returns proposed changes as text, applies nothing. */
  router.post('/api/ai/suggest', async ({ json }) => {
    const { reportId, issueIds } = await json<{ reportId?: string; issueIds: string[] }>()
    const report = reportId ? await ctx.store.get(reportId) : await ctx.store.latest()
    if (!report) throw new PerfAgentError('NOT_FOUND', 'No report')
    const issues = report.issues.filter((i) => issueIds.includes(i.id))
    const files =
      ctx.mode.mode === 'local'
        ? await gatherContext(ctx.config.root, issues, ctx.config.ai.sendCode)
        : []
    await ctx.store.appendLog(
      'audit.log',
      `suggest ${issues.length} issues via ${await ai().activeProvider()}`,
    )
    return { changes: await ai().proposeFix(issues, files) }
  })

  /** Aggregates of AI calls measured by watchAI / the proxy / the browser agent. */
  router.get('/api/ai/report', () => ai().report())
  router.post('/api/ai/compare-models', async ({ json }) => {
    const { questions, models } = await json<{
      questions: string[]
      models: { provider: ProviderStatus['id']; model: string }[]
    }>()
    if (
      !Array.isArray(questions) ||
      !questions.length ||
      !Array.isArray(models) ||
      models.length < 2
    )
      throw new PerfAgentError('IMPORT_INVALID', 'Give at least one question and two models')
    await ctx.store.appendLog(
      'audit.log',
      `compare-models ${models.map((m) => `${m.provider}/${m.model}`).join(',')} questions=${questions.length}`,
    )
    return { rows: await ai().compareModels(questions.slice(0, 5), models.slice(0, 6)) }
  })

  /** Local mode offers one-click connect with this exact install; a deployed server only hands out the npx snippets. */
  const clients = (): ReturnType<typeof mcpClients> =>
    ctx.mode.mode === 'local' && !ctx.staticBuild
      ? mcpClients(currentLaunch(ctx.config.root))
      : MCP_CONFIGS

  router.get('/api/ai/mcp-config', ({ query }) => {
    const client = query.get('client')
    if (client) {
      const cfg = clients()[client]
      if (!cfg) throw new PerfAgentError('NOT_FOUND', 'Unknown MCP client')
      return cfg
    }
    return clients()
  })

  /** "Download free model": progress goes out over the WebSocket as `ai:pull`. */
  router.post('/api/ai/pull', async ({ json }) => {
    const { model } = await json<{ model?: string }>()
    // Ollama model names are short tokens like qwen2.5-coder:1.5b; anything else is refused.
    if (!model || !/^[\w./-]+(:[\w.-]+)?$/.test(model) || model.length > 100)
      throw new PerfAgentError('IMPORT_INVALID', 'Pick a model from the list')
    // Ollama reports every chunk; one message per whole percent is plenty for a progress bar.
    let last = { percent: -1, status: '' }
    void ai()
      .pullModel(model, (fraction, status) => {
        const percent = Math.floor(fraction * 100)
        if (percent === last.percent && status === last.status) return
        last = { percent, status }
        ctx.hub.broadcast({ type: 'ai:pull', model, fraction, status })
      })
      .then(() =>
        ctx.hub.broadcast({ type: 'ai:pull', model, fraction: 1, status: 'done', done: true }),
      )
      .catch((error: unknown) =>
        ctx.hub.broadcast({
          type: 'ai:pull',
          model,
          fraction: 0,
          status: error instanceof Error ? error.message : String(error),
          done: true,
          error: true,
        }),
      )
    await ctx.store.appendLog('audit.log', `pull model ${model}`)
    return { started: true }
  })

  router.post('/api/ai/openrouter', async ({ json }) => {
    const { code, verifier } = await json<{ code?: string; verifier?: string }>()
    if (!code || !verifier || code.length > 500 || verifier.length > 200)
      throw new PerfAgentError('IMPORT_INVALID', 'The OpenRouter login did not finish')
    await ai().connectOpenRouter(code, verifier)
    await ctx.store.appendLog('audit.log', 'key stored for openrouter (login)')
    return { connected: true }
  })
}
