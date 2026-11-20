import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanProject } from '@perfagent/scanner'
import { describe, expect, it } from 'vitest'

import { detectIssues, packsFor } from '../src/index.js'

const demoShop = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/demo-shop',
)

/** The 12 seeded problems and where each one lives. */
const SEEDED: { rule: string; file: string }[] = [
  { rule: 'general/lcp-image-lazy', file: 'src/components/HeroBanner.tsx' },
  { rule: 'react/context-rerender', file: 'src/components/CartSummary.tsx' },
  { rule: 'react/namespace-import', file: 'src/lib/dates.ts' },
  { rule: 'realtime/reconnect-no-backoff', file: 'src/lib/socket.ts' },
  { rule: 'ai/sequential-await', file: 'src/server/rag.ts' },
  { rule: 'general/blocking-third-party', file: 'index.html' },
  { rule: 'react/effect-without-cleanup', file: 'src/components/LiveStock.tsx' },
  { rule: 'general/font-display-missing', file: 'src/styles/fonts.css' },
  { rule: 'general/unused-css', file: 'src/styles/legacy.css' },
  { rule: 'general/uncached-api', file: 'src/server/api/products.ts' },
  { rule: 'general/image-missing-dimensions', file: 'src/components/ProductCard.tsx' },
  { rule: 'react/eager-conditional-import', file: 'src/components/Header.tsx' },
]

describe('rule packs on demo-shop', async () => {
  const scan = await scanProject({ root: demoShop, exclude: ['**/node_modules/**', '**/dist/**'] })
  const issues = detectIssues({ scan, pages: [], packs: packsFor(scan.framework, 'auto') })

  it('detects the framework', () => {
    expect(scan.framework).toBe('react')
  })

  it.each(SEEDED)('finds $rule in $file', ({ rule, file }) => {
    const hit = issues.find((i) => i.ruleId === rule && i.location?.file === file)
    expect(
      hit,
      `${rule} missing; found: ${
        issues
          .filter((i) => i.ruleId === rule)
          .map((i) => i.location?.file)
          .join(', ') || 'nothing'
      }`,
    ).toBeDefined()
    expect(hit?.location?.line).toBeGreaterThan(0)
    expect(hit?.chain.length).toBeGreaterThanOrEqual(2)
    expect(hit?.fix.steps.length).toBeGreaterThan(0)
    expect(hit?.gain.scoreDelta).toBeGreaterThanOrEqual(0)
  })

  it('also catches the uncached system prompt in the RAG route', () => {
    expect(
      issues.some(
        (i) => i.ruleId === 'ai/no-prompt-cache' && i.location?.file === 'src/server/rag.ts',
      ),
    ).toBe(true)
  })

  it('gives every issue a unique id and plain-language text', () => {
    const ids = new Set(issues.map((i) => i.id))
    expect(ids.size).toBe(issues.length)
    for (const issue of issues) {
      expect(issue.plain.length).toBeGreaterThan(10)
      expect(issue.why.length).toBeGreaterThan(20)
    }
  })

  it('builds the tree with components and elements', () => {
    expect(scan.tree.children.length).toBeGreaterThan(0)
    const header = findByPath(scan.tree, 'src/components/Header.tsx')
    expect(header?.children.some((c) => c.kind === 'component' && c.name === 'Header')).toBe(true)
  })
})

function findByPath(
  node: { path: string; kind: string; children: (typeof node)[] },
  p: string,
): typeof node | undefined {
  if (node.path === p && node.kind === 'file') return node
  for (const child of node.children) {
    const hit = findByPath(child, p)
    if (hit) return hit
  }
  return undefined
}
