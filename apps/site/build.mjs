// Builds apps/site/dist: landing page, docs (from docs/*.md and docs/guides/*.md), the guide index
// for the static dashboard, and the static dashboard itself when packages/web/dist-static exists.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { marked } from 'marked'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..')
const dist = path.join(here, 'dist')
const docsDir = path.join(repo, 'docs')
const guidesDir = path.join(docsDir, 'guides')

rmSync(dist, { recursive: true, force: true })
mkdirSync(path.join(dist, 'docs'), { recursive: true })
mkdirSync(path.join(dist, 'guides'), { recursive: true })

// Landing page and styles.
cpSync(path.join(here, 'index.html'), path.join(dist, 'index.html'))
cpSync(path.join(here, 'site.css'), path.join(dist, 'site.css'))

// Static dashboard: copied when the web package produced its static build.
const staticDashboard = path.join(repo, 'packages', 'web', 'dist-static')
if (existsSync(staticDashboard)) {
  cpSync(staticDashboard, path.join(dist, 'app'), { recursive: true })
  console.log('site: copied packages/web/dist-static → dist/app/')
} else {
  mkdirSync(path.join(dist, 'app'), { recursive: true })
  writeFileSync(
    path.join(dist, 'app', 'index.html'),
    layout(
      'Demo dashboard',
      '<h1>Demo dashboard</h1><p>The static dashboard is not part of this build yet. Run <code>pnpm --filter @perfagent/web build:static</code> before <code>pnpm --filter perfagent-site build</code>, or install PerfAgent locally: <code>npx perfagent</code>.</p>',
      '../',
    ),
  )
  console.log('site: packages/web/dist-static missing; wrote a placeholder at dist/app/')
}

// Guides: front matter → index.json, raw .md copied for the static dashboard, HTML page per guide.
// The Markdown is our own (docs/), so it is rendered without sanitising; never feed user content here.
const frontMatter = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  const meta = {}
  if (m)
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  return { meta, body: m ? text.slice(m[0].length) : text }
}
const guides = []
for (const file of readdirSync(guidesDir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
  const topic = file.replace(/\.md$/, '')
  const text = readFileSync(path.join(guidesDir, file), 'utf8')
  const { meta, body } = frontMatter(text)
  guides.push({
    topic,
    title: meta.title ?? topic,
    group: meta.group ?? 'Other',
    summary: meta.summary ?? '',
    order: Number(meta.order ?? 999),
    tryIt: meta.tryIt,
    metric: meta.metric,
  })
  cpSync(path.join(guidesDir, file), path.join(dist, 'guides', file))
  writeFileSync(
    path.join(dist, 'docs', `guide-${topic}.html`),
    layout(
      meta.title ?? topic,
      `<p class="crumb"><a href="./">Docs</a> · ${esc(meta.group ?? '')}</p><h1>${esc(meta.title ?? topic)}</h1><p class="lead">${esc(meta.summary ?? '')}</p>${renderGuide(body)}`,
      '../',
    ),
  )
}
guides.sort((a, b) => a.order - b.order)
writeFileSync(path.join(dist, 'guides', 'index.json'), JSON.stringify(guides, null, 2))

// Top-level docs.
const pages = []
for (const file of readdirSync(docsDir).filter((f) => f.endsWith('.md'))) {
  const name = file.replace(/\.md$/, '')
  const text = readFileSync(path.join(docsDir, file), 'utf8')
  const title = /^# (.+)$/m.exec(text)?.[1] ?? name
  pages.push({ name, title })
  writeFileSync(
    path.join(dist, 'docs', `${name}.html`),
    layout(
      title,
      `<p class="crumb"><a href="./">Docs</a></p>${marked.parse(rewriteLinks(text))}`,
      '../',
    ),
  )
}

// Docs index.
const groups = [...new Set(guides.map((g) => g.group))]
const index = `<h1>Documentation</h1>
<h2>Reference</h2><ul>${pages.map((p) => `<li><a href="${p.name}.html">${esc(p.title)}</a></li>`).join('')}</ul>
<h2>Guides</h2>${groups
  .map(
    (g) =>
      `<h3>${esc(g)}</h3><ul>${guides
        .filter((x) => x.group === g)
        .map(
          (x) =>
            `<li><a href="guide-${x.topic}.html">${esc(x.title)}</a> <span class="muted">${esc(x.summary)}</span></li>`,
        )
        .join('')}</ul>`,
  )
  .join('')}`
writeFileSync(path.join(dist, 'docs', 'index.html'), layout('Docs', index, '../'))
console.log(
  `site: ${pages.length} docs pages, ${guides.length} guides → ${path.relative(repo, dist)}`,
)

function renderGuide(body) {
  // The walkthrough block is JSON for the app; show it as a numbered list on the site.
  const withSteps = body.replace(/```walkthrough\n([\s\S]*?)```/g, (_m, json) => {
    try {
      return JSON.parse(json)
        .map((s, i) => `${i + 1}. **${s.title}** (${s.screen}) — ${s.text}`)
        .join('\n')
    } catch {
      return ''
    }
  })
  return marked.parse(rewriteLinks(withSteps))
}

// Repo-relative Markdown links → site pages.
function rewriteLinks(md) {
  return md
    .replace(
      /\]\(\.\.\/security\/([A-Z_]+)\.md\)/g,
      '](https://github.com/gole8701/Aiperfagent/blob/main/security/$1.md)',
    )
    .replace(
      /\]\(\.\.\/SECURITY\.md\)/g,
      '](https://github.com/gole8701/Aiperfagent/blob/main/SECURITY.md)',
    )
    .replace(/\]\(docs\/([a-z-]+)\.md\)/g, ']($1.html)')
    .replace(/\]\(([a-z-]+)\.md\)/g, ']($1.html)')
}

function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )
}

function layout(title, content, base) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · PerfAgent</title>
<meta name="description" content="PerfAgent finds, explains and fixes web and AI performance problems down to the exact file and line.">
<link rel="stylesheet" href="${base}site.css">
</head>
<body class="doc">
<header class="top"><a class="brand" href="${base}">PerfAgent</a><nav><a href="${base}docs/">Docs</a><a href="${base}app/">Demo</a><a href="https://github.com/gole8701/Aiperfagent">GitHub</a></nav></header>
<main class="prose">${content}</main>
<footer class="foot">MIT licence · <a href="https://github.com/gole8701/Aiperfagent">Source</a> · <a href="https://github.com/gole8701/Aiperfagent/blob/main/SECURITY.md">Security</a> · Local only, no telemetry, your own AI.</footer>
</body>
</html>
`
}
