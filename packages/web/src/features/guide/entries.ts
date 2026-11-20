import type { GuideMeta } from '../../api/types'

import { GROUPS, TOPICS, type TopicContent } from './content'

export interface Entry {
  topic: string
  title: string
  summary: string
  group: string
  content?: TopicContent
}

/** Topics in the order of content.ts, then any extra Markdown topics the server has. */
export function toEntries(guides: GuideMeta[]): Entry[] {
  const byTopic = new Map(guides.map((g) => [g.topic, g]))
  const known = Object.entries(TOPICS).flatMap(([topic, content]) => {
    const meta = byTopic.get(topic)
    return meta
      ? [{ topic, title: meta.title, summary: meta.summary, group: content.group, content }]
      : []
  })
  const extra = guides
    .filter((g) => !(g.topic in TOPICS) && g.topic.toLowerCase() !== 'readme')
    .map((g) => ({ topic: g.topic, title: g.title, summary: g.summary, group: 'More' }))
  return [...known, ...extra]
}

export function groupEntries(entries: Entry[]): { name: string; entries: Entry[] }[] {
  const names = [...GROUPS, ...new Set(entries.map((e) => e.group))]
  return [...new Set(names)]
    .map((name) => ({ name, entries: entries.filter((e) => e.group === name) }))
    .filter((g) => g.entries.length)
}

export function searchText(content?: TopicContent): string {
  if (!content) return ''
  return [
    content.line,
    content.what,
    content.analogy,
    content.why,
    ...content.check.map((s) => s.text),
    ...(content.causes ?? []).flatMap((c) => [c.cause, c.fix, c.rule ?? '']),
  ].join(' ')
}
