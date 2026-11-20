import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Finishes the static website build: copies the demo report and the guides
 * into dist-static and writes guides/index.json from their front matter.
 * PERFAGENT_GUIDES_DIR overrides the guide source (the e2e suite points it at
 * its own fixtures so tests never depend on docs/guides being written).
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const web = path.resolve(here, '..')
const repo = path.resolve(web, '../..')
const out = path.join(web, 'dist-static')

await mkdir(path.join(out, 'demo'), { recursive: true })
await cp(
  path.join(repo, 'fixtures/reports/demo-shop-before.json'),
  path.join(out, 'demo/demo-shop-before.json'),
)

const candidates = [
  process.env.PERFAGENT_GUIDES_DIR && path.resolve(process.env.PERFAGENT_GUIDES_DIR),
  path.join(repo, 'docs/guides'),
  path.join(web, 'e2e/fixtures/guides'),
].filter(Boolean)
let source
for (const dir of candidates) {
  const files = await readdir(dir).catch(() => [])
  if (files.some((f) => f.endsWith('.md'))) {
    source = dir
    break
  }
}
if (!source) {
  console.log('static-assets: no guides found')
  process.exit(0)
}

await mkdir(path.join(out, 'guides'), { recursive: true })
const index = []
for (const file of (await readdir(source)).filter((f) => f.endsWith('.md'))) {
  const text = await readFile(path.join(source, file), 'utf8')
  await writeFile(path.join(out, 'guides', file), text)
  // Translations (<topic>.hi.md) are copied but not listed as topics.
  if (/\.(hi|mr)\.md$/.test(file)) continue
  index.push(frontMatter(text, file.replace(/\.md$/, '')))
}
index.sort((a, b) => a.order - b.order)
await writeFile(path.join(out, 'guides/index.json'), JSON.stringify(index))
console.log(`static-assets: ${index.length} guides from ${path.relative(repo, source)}`)

function frontMatter(text, topic) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  const fields = {}
  if (match) {
    for (const line of match[1].split('\n')) {
      const [key, ...rest] = line.split(':')
      if (key && rest.length)
        fields[key.trim()] = rest
          .join(':')
          .trim()
          .replace(/^["']|["']$/g, '')
    }
  }
  return {
    topic,
    title: fields.title ?? topic,
    group: fields.group ?? 'Other',
    summary: fields.summary ?? '',
    order: Number(fields.order ?? 999),
    tryIt: fields.tryIt,
    metric: fields.metric,
  }
}
