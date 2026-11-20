// Checks every guide in docs/guides: front matter, heading order and step format. Run: pnpm docs:check
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const TOPICS = [
  'install',
  'scan-project',
  'test-url',
  'globe',
  'chips',
  'deep-dive',
  'flow-diagram',
  'open-in-editor',
  'charts',
  'score',
  'lcp',
  'inp',
  'cls',
  'ttfb',
  'tbt',
  'bundle',
  'memory',
  'live',
  'locations',
  'measure-ai',
  'ai-first-token',
  'ai-cost',
  'agent-readiness',
  'fix-with-ai',
  'connect-ai',
  'connect-mcp',
  'fix-production-locally',
  'retest-compare',
  'budgets-ci',
  'security-local-mode',
  'themes-export',
  'fcp',
]
const GROUPS = [
  'Get started',
  'Explore',
  'Metrics',
  'Live & locations',
  'AI',
  'Fix & connect',
  'Settings',
]
const HEADINGS = [
  'What it is',
  'Why it matters',
  'Use case',
  'How it helps your app',
  'Good, needs work, poor',
  'How to do it in PerfAgent, step by step',
  'Commands & config',
  'Expert detail',
  'Learn more',
  'हिन्दी',
  'मराठी',
]
const OPTIONAL = new Set(['Good, needs work, poor', 'Commands & config', 'हिन्दी', 'मराठी'])

const problems = []
const files = (await readdir(dir))
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => f.replace(/\.md$/, ''))
for (const topic of TOPICS) if (!files.includes(topic)) problems.push(`${topic}.md is missing`)
for (const file of files)
  if (!TOPICS.includes(file)) problems.push(`${file}.md is not in the catalogue`)

const orders = new Map()
for (const topic of files.filter((f) => TOPICS.includes(f))) {
  const text = await readFile(path.join(dir, `${topic}.md`), 'utf8')
  const fail = (msg) => problems.push(`${topic}: ${msg}`)
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!fm) {
    fail('no front matter')
    continue
  }
  const fields = Object.fromEntries(
    fm[1]
      .split('\n')
      .map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]),
  )
  for (const key of ['title', 'group', 'summary', 'order', 'tryIt'])
    if (!fields[key]) fail(`front matter is missing "${key}"`)
  if (!GROUPS.includes(fields.group))
    fail(`group "${fields.group}" is not one of ${GROUPS.join(' · ')}`)
  const order = Number(fields.order)
  if (order !== TOPICS.indexOf(topic) + 1)
    fail(`order should be ${TOPICS.indexOf(topic) + 1}, found ${fields.order}`)
  if (orders.has(order)) fail(`order ${order} is also used by ${orders.get(order)}`)
  orders.set(order, topic)
  if (!fields.tryIt?.startsWith('/')) fail('tryIt must be a dashboard route starting with /')
  const isMetric = fields.group === 'Metrics'
  if (isMetric && !fields.metric) fail('metric guides need a "metric" front matter field')

  const found = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  const expected = HEADINGS.filter((h) => !OPTIONAL.has(h) || found.includes(h))
  if (isMetric && !found.includes('Good, needs work, poor'))
    fail('metric guide needs "## Good, needs work, poor"')
  for (const h of found) if (!HEADINGS.includes(h)) fail(`unknown heading "## ${h}"`)
  if (found.join('|') !== expected.join('|'))
    fail(`headings out of order or missing. Found: ${found.join(' > ')}`)

  const stepsSection =
    text.split('## How to do it in PerfAgent, step by step')[1]?.split('\n## ')[0] ?? ''
  if (!/^\d+\. \*\*[^*]+:\*\*/m.test(stepsSection))
    fail('steps must be numbered and start with the screen name in bold, e.g. "1. **Globe:** …"')
}

if (problems.length) {
  console.error(`Guide check: ${problems.length} problem${problems.length > 1 ? 's' : ''}`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(
  `Guide check: all ${files.length} guides pass (${TOPICS.length} topics, ${GROUPS.length} groups)`,
)
