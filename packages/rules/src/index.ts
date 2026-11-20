import type { Framework } from '@perfagent/scanner'

import { runRules, type Rule, type RuleContext } from './engine.js'
import { agentRules } from './packs/agents.js'
import { aiRules } from './packs/ai.js'
import { generalRules } from './packs/general.js'
import { nextRules } from './packs/next.js'
import { reactRules } from './packs/react.js'
import { realtimeRules } from './packs/realtime.js'

export { runRules, severityRank } from './engine.js'
export type { Rule, RuleContext, Finding } from './engine.js'

/** Registry: adding a pack means adding one line here. */
export const allRules: Rule[] = [
  ...generalRules,
  ...reactRules,
  ...nextRules,
  ...realtimeRules,
  ...aiRules,
  ...agentRules,
]

export const packNames = ['general', 'react', 'next', 'realtime', 'ai', 'agents'] as const
export type PackName = (typeof packNames)[number]

/** `auto`: packs picked from the detected framework; realtime and ai packs are cheap and always on. */
export function packsFor(framework: Framework | undefined, setting: 'auto' | string[]): string[] {
  if (setting !== 'auto') return setting
  const packs = ['general', 'realtime', 'ai', 'agents']
  if (framework === 'react' || framework === 'next' || framework === 'remix') packs.push('react')
  if (framework === 'next') packs.push('next')
  return packs
}

export function findRule(id: string): Rule | undefined {
  return allRules.find((r) => r.id === id)
}

export function detectIssues(
  ctx: RuleContext,
  disabled: string[] = [],
): ReturnType<typeof runRules> {
  return runRules(allRules, ctx, disabled)
}
