import { readFileSync } from 'node:fs'
import path from 'node:path'

import { compareReports, type Report } from '@perfagent/core'
import { describe, expect, it } from 'vitest'

import { comparisonToMarkdown } from './markdown'

const before = JSON.parse(
  readFileSync(
    path.resolve(__dirname, '../../../../../fixtures/reports/demo-shop-before.json'),
    'utf8',
  ),
) as Report

function improved(): Report {
  const page = before.pages[0]
  if (!page) throw new Error('fixture has no page')
  return {
    ...before,
    id: 'after',
    label: 'after fixes',
    pages: [
      {
        ...page,
        metrics: page.metrics.map((m) =>
          m.id === 'lcp' ? { ...m, value: 2400 } : m.id === 'score' ? { ...m, value: 81 } : m,
        ),
      },
    ],
    issues: before.issues.filter((i) => i.ruleId !== 'general/lcp-image-lazy'),
  }
}

describe('comparisonToMarkdown', () => {
  it('writes a PR-ready table with the verdict, fixed problems and next steps', () => {
    const md = comparisonToMarkdown(compareReports(before, improved()))
    expect(md).toContain('## PerfAgent compare')
    expect(md).toContain('| LCP |')
    expect(md).toContain('better')
    expect(md).toContain('**Fixed:**')
    expect(md).toContain('### What to do next')
    expect(md).toContain('HeroBanner.tsx:5')
  })

  it('shows fairness warnings as quotes', () => {
    const desktop = {
      ...improved(),
      environment: { ...before.environment, device: 'desktop' as const },
    }
    const md = comparisonToMarkdown(compareReports(before, desktop))
    expect(md).toContain('> ⚠️ A is mobile, B is desktop')
  })
})
