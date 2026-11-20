import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { PerfAgentError } from '@perfagent/core'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

export interface GuideMeta {
  topic: string
  title: string
  group: string
  summary: string
  order: number
  tryIt?: string
  metric?: string
}

/** Guides are Markdown files in docs/guides with a small front matter block. The same files power the website. */
export function guideRoutes(router: Router, ctx: AppContext): void {
  router.get('/api/guides', async () => (ctx.guidesDir ? listGuides(ctx.guidesDir) : []))
  router.get('/api/guides/:topic', async ({ params }) => {
    const topic = (params.topic ?? '').replace(/[^a-z0-9-]/gi, '')
    if (!ctx.guidesDir || !topic) throw new PerfAgentError('NOT_FOUND', 'Guide not found')
    const text = await readFile(path.join(ctx.guidesDir, `${topic}.md`), 'utf8').catch(
      () => undefined,
    )
    if (text === undefined) throw new PerfAgentError('NOT_FOUND', `No guide called "${topic}"`)
    const { meta, body } = parseFrontMatter(text, topic)
    return { ...meta, body }
  })
}

export async function listGuides(dir: string): Promise<GuideMeta[]> {
  const files = await readdir(dir).catch(() => [])
  const guides: GuideMeta[] = []
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const text = await readFile(path.join(dir, file), 'utf8')
    guides.push(parseFrontMatter(text, file.replace(/\.md$/, '')).meta)
  }
  return guides.sort((a, b) => a.order - b.order)
}

export function parseFrontMatter(text: string, topic: string): { meta: GuideMeta; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  const fields: Record<string, string> = {}
  if (match)
    for (const line of (match[1] ?? '').split('\n')) {
      const [key, ...rest] = line.split(':')
      if (key && rest.length)
        fields[key.trim()] = rest
          .join(':')
          .trim()
          .replace(/^["']|["']$/g, '')
    }
  const body = match ? text.slice(match[0].length) : text
  return {
    meta: {
      topic,
      title: fields.title ?? topic,
      group: fields.group ?? 'Other',
      summary: fields.summary ?? '',
      order: Number(fields.order ?? 999),
      tryIt: fields.tryIt,
      metric: fields.metric,
    },
    body,
  }
}
