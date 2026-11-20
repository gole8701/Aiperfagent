import type { Rule } from '../engine.js'

/** Agent-readiness: how easily AI browsers and assistants can use the site. Needs the readiness collector. */
export const agentReadinessLow: Rule = {
  id: 'agents/readiness-low',
  pack: 'agents',
  title: 'Hard for AI assistants to use',
  plain: 'AI browsers and assistants struggle to understand this page',
  severity: 'warning',
  metrics: ['agentReadiness'],
  areas: ['agents', 'accessibility'],
  why: 'Agents rely on the accessibility tree, names on buttons and links, structured data and llms.txt. Missing names make them guess and fail.',
  docs: [
    { label: 'llms.txt', url: 'https://llmstxt.org' },
    {
      label: 'MDN: Accessible names',
      url: 'https://developer.mozilla.org/docs/Glossary/Accessible_name',
    },
  ],
  steps: [
    'Give every button, link and input an accessible name',
    'Add structured data (JSON-LD) for products and articles',
    'Publish /llms.txt describing the site',
  ],
  detect: ({ pages }) => {
    const out = []
    for (const page of pages) {
      const score = page.features?.agentReadiness
      if (typeof score !== 'number' || score >= 70) continue
      out.push({
        route: page.route,
        chain: {
          metric: 'agentReadiness' as const,
          value: score,
          element: `${String(page.features?.missingLabels ?? 0)} controls without a name`,
        },
        gain: { from: score, to: 85, scoreDelta: 0 },
        confidence: 0.8,
      })
    }
    return out
  },
}

export const agentRules: Rule[] = [agentReadinessLow]
