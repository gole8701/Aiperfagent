import {
  configSchema,
  deepMerge,
  describeConfig,
  type PerfAgentConfigInput,
} from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

/**
 * Settings changed in the dashboard are stored as an overlay in
 * `.perfagent/settings.json` (never written into perfagent.config.ts) and
 * applied on top of the loaded config for this process.
 */
export function settingsRoutes(router: Router, ctx: AppContext): void {
  const SAFE_SECTIONS = [
    'device',
    'runs',
    'editor',
    'theme',
    'language',
    'ai',
    'fix',
    'live',
    'budgets',
    'rules',
    'urls',
  ] as const

  router.get('/api/settings', () => ({
    config: publicConfig(ctx),
    schema: describeConfig(),
    file: undefined,
  }))

  router.put('/api/settings', async ({ json }) => {
    const patch = await json<Partial<PerfAgentConfigInput>>()
    const allowed: Record<string, unknown> = {}
    for (const key of SAFE_SECTIONS)
      if (key in patch) allowed[key] = (patch as Record<string, unknown>)[key]
    const merged = configSchema.safeParse(
      deepMerge(ctx.config as unknown as Record<string, unknown>, allowed),
    )
    if (!merged.success) {
      const first = merged.error.issues[0]
      throw new PerfAgentError(
        'CONFIG_INVALID',
        `Setting ${first?.path.join('.') ?? ''}: ${first?.message ?? 'invalid'}`,
      )
    }
    Object.assign(ctx.config, { ...merged.data, root: ctx.config.root })
    const overlay = await ctx.store.readJson<Record<string, unknown>>('settings.json', {})
    await ctx.store.writeJson('settings.json', deepMerge(overlay, allowed))
    return { config: publicConfig(ctx) }
  })
}

function publicConfig(ctx: AppContext): Record<string, unknown> {
  const { root: _root, ...rest } = ctx.config
  return rest
}
