import { PerfAgentError } from '@perfagent/core'
import { gatherContext, type ProviderStatus } from '@perfagent/engine'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

/** MCP client configs. Formats change; these match the tools' docs at the time of release. */
export const MCP_CONFIGS: Record<string, { label: string; file: string; snippet: string }> = {
  'claude-code': {
    label: 'Claude Code',
    file: 'terminal',
    snippet: 'claude mcp add perfagent -- npx -y perfagent mcp',
  },
  'claude-desktop': {
    label: 'Claude Desktop',
    file: 'claude_desktop_config.json',
    snippet: JSON.stringify(
      { mcpServers: { perfagent: { command: 'npx', args: ['-y', 'perfagent', 'mcp'] } } },
      null,
      2,
    ),
  },
  cursor: {
    label: 'Cursor',
    file: '.cursor/mcp.json',
    snippet: JSON.stringify(
      { mcpServers: { perfagent: { command: 'npx', args: ['-y', 'perfagent', 'mcp'] } } },
      null,
      2,
    ),
  },
  windsurf: {
    label: 'Windsurf',
    file: '~/.codeium/windsurf/mcp_config.json',
    snippet: JSON.stringify(
      { mcpServers: { perfagent: { command: 'npx', args: ['-y', 'perfagent', 'mcp'] } } },
      null,
      2,
    ),
  },
  copilot: {
    label: 'VS Code + GitHub Copilot',
    file: '.vscode/mcp.json',
    snippet: JSON.stringify(
      { servers: { perfagent: { command: 'npx', args: ['-y', 'perfagent', 'mcp'] } } },
      null,
      2,
    ),
  },
  cline: {
    label: 'Cline',
    file: 'cline_mcp_settings.json',
    snippet: JSON.stringify(
      { mcpServers: { perfagent: { command: 'npx', args: ['-y', 'perfagent', 'mcp'] } } },
      null,
      2,
    ),
  },
  zed: {
    label: 'Zed',
    file: 'settings.json',
    snippet: JSON.stringify(
      {
        context_servers: {
          perfagent: { command: { path: 'npx', args: ['-y', 'perfagent', 'mcp'] } },
        },
      },
      null,
      2,
    ),
  },
  chatgpt: {
    label: 'ChatGPT (connectors)',
    file: 'remote',
    snippet:
      'PERFAGENT_MCP_TOKEN=<long-random-token> npx perfagent mcp --http --port 4546\n' +
      '# ChatGPT needs a remote HTTPS endpoint: put this behind an HTTPS tunnel or proxy\n' +
      '# that sends "Authorization: Bearer $PERFAGENT_MCP_TOKEN", then add https://<tunnel>/mcp',
  },
}

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

  router.get('/api/ai/mcp-config', ({ query }) => {
    const client = query.get('client')
    if (client) {
      const cfg = MCP_CONFIGS[client]
      if (!cfg) throw new PerfAgentError('NOT_FOUND', 'Unknown MCP client')
      return cfg
    }
    return MCP_CONFIGS
  })
}
