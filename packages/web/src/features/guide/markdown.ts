import DOMPurify from 'dompurify'
import { marked } from 'marked'

export interface GuideSection {
  title: string
  html: string
}

marked.setOptions({ gfm: true, breaks: false })

/** Markdown → sanitised HTML. Links open in a new tab; scripts, handlers and styles never survive. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false })
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input'],
  }).replace(/<a /g, '<a target="_blank" rel="noreferrer noopener" ')
}

/** Splits a guide into its `##` sections and renders each one. */
export function parseGuide(body: string): GuideSection[] {
  return splitSections(body).map((s) => ({ title: s.title, html: renderMarkdown(s.raw) }))
}

function splitSections(markdown: string): { title: string; raw: string }[] {
  const lines = markdown.split('\n')
  const out: { title: string; raw: string }[] = []
  let current = { title: '', raw: '' }
  let inFence = false
  for (const line of lines) {
    if (line.startsWith('```')) inFence = !inFence
    const heading = !inFence ? /^##\s+(.+)$/.exec(line) : null
    if (heading) {
      if (current.raw.trim() || current.title) out.push(current)
      current = { title: heading[1]?.trim() ?? '', raw: '' }
    } else {
      current.raw += `${line}\n`
    }
  }
  if (current.raw.trim() || current.title) out.push(current)
  return out
}
