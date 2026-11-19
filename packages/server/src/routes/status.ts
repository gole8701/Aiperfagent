import { describeConfig } from '@perfagent/config'
import { gitInfo } from '@perfagent/engine'

import type { AppContext } from '../app.js'
import { EDITOR_LABELS } from '../editor.js'
import type { Router } from '../router.js'

export function statusRoutes(router: Router, ctx: AppContext): void {
  router.get('/api/status', async () => {
    const latest = await ctx.store.latest().catch(() => undefined)
    const git = await gitInfo(ctx.config.root)
    return {
      version: ctx.version,
      mode: ctx.mode.mode,
      modeReasons: ctx.mode.reasons,
      project: { root: ctx.config.root, name: ctx.config.root.split(/[\\/]/).pop(), framework: latest?.build?.framework, frameworkVersion: latest?.build?.frameworkVersion, commit: git.commit, branch: git.branch },
      config: { urls: ctx.config.urls, device: ctx.config.device, runs: ctx.config.runs, editor: ctx.config.editor, theme: ctx.config.theme, language: ctx.config.language, aiProvider: ctx.config.ai.provider, environments: ctx.config.environments },
      editors: EDITOR_LABELS,
      latestReportId: latest?.id,
      capabilities: {
        scanProject: ctx.mode.mode === 'local',
        openEditor: ctx.mode.mode === 'local',
        applyFixes: ctx.mode.mode === 'local' && Boolean(ctx.fix),
        ai: Boolean(ctx.ai),
        live: !ctx.staticBuild,
      },
      options: describeConfig(),
    }
  })
}
