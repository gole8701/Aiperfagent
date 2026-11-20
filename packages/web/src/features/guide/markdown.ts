import DOMPurify from 'dompurify'
import { marked } from 'marked'

import type { SceneId } from './scenes'

export interface WalkthroughStep {
  screen: SceneId
  area: string
  title: string
  text: string
}

export interface GuideSection {
  title: string
  html: string
  /** Sections whose heading mentions "expert" are hidden in Beginner mode. */
  expert: boolean
}

export interface ParsedGuide {
  sections: GuideSection[]
  walkthrough: WalkthroughStep[]
  /** Fenced code blocks from the "Commands & config" section, each with a Copy button. */
  commands: string[]
}

marked.setOptions({ gfm: true, breaks: false })

/** Markdown → sanitised HTML. Links open in a new tab; scripts, handlers and styles never survive. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false })
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input'] }).replace(/<a /g, '<a target="_blank" rel="noreferrer noopener" ')
}

const WALKTHROUGH_BLOCK = /```walkthrough\s*\n([\s\S]*?)```/g
const SCENES: SceneId[] = ['globe', 'flow', 'charts', 'compare', 'terminal', 'settings', 'editor', 'assistant']

export function parseGuide(body: string): ParsedGuide {
  const walkthrough: WalkthroughStep[] = []
  const withoutWalkthrough = body.replace(WALKTHROUGH_BLOCK, (_match, json: string) => {
    try {
      const steps = JSON.parse(json) as unknown
      if (Array.isArray(steps)) for (const step of steps) if (isStep(step)) walkthrough.push(step)
    } catch {
      // A malformed walkthrough block is dropped; the written steps still render.
    }
    return ''
  })
  const sections = splitSections(withoutWalkthrough)
  const commandsSection = sections.find((s) => /commands|config/i.test(s.title))
  const commands = commandsSection ? [...commandsSection.raw.matchAll(/```[a-z]*\s*\n([\s\S]*?)```/g)].map((m) => (m[1] ?? '').trim()).filter(Boolean) : []
  return { sections: sections.map((s) => ({ title: s.title, html: renderMarkdown(s.raw), expert: /expert/i.test(s.title) })), walkthrough, commands }
}

function isStep(value: unknown): value is WalkthroughStep {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.screen === 'string' && SCENES.includes(v.screen as SceneId) && typeof v.area === 'string' && typeof v.title === 'string' && typeof v.text === 'string'
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
