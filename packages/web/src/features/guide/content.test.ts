import { existsSync } from 'node:fs'
import path from 'node:path'

import { METRICS } from '@perfagent/core'
import { describe, expect, it } from 'vitest'

import { ALIASES, TOPICS } from './content'
import { SHOTS } from './shots'

const docs = path.resolve(import.meta.dirname, '../../../../../docs/guides')
const publicDir = path.resolve(import.meta.dirname, '../../../public/guide')

describe('guide content', () => {
  it('points every step at a control captured in a screenshot', () => {
    const missing = Object.entries(TOPICS).flatMap(([topic, content]) =>
      content.check
        .filter((step) => !SHOTS[step.shot]?.[step.at])
        .map((step) => `${topic}: ${step.shot}.${step.at}`),
    )
    expect(missing).toEqual([])
  })

  it('has an image for every screenshot', () => {
    for (const shot of Object.keys(SHOTS))
      expect(existsSync(path.join(publicDir, `${shot}.webp`)), shot).toBe(true)
  })

  it('has a Markdown guide for every topic, every alias and every metric help link', () => {
    const slugs = [
      ...Object.keys(TOPICS),
      ...Object.values(ALIASES),
      ...Object.values(METRICS).map((m) => ALIASES[m.guide] ?? m.guide),
    ]
    for (const slug of slugs) expect(existsSync(path.join(docs, `${slug}.md`)), slug).toBe(true)
  })

  it('keeps every topic to 3–5 steps', () => {
    for (const [topic, content] of Object.entries(TOPICS))
      expect(content.check.length, topic).toBeGreaterThanOrEqual(3)
    for (const [topic, content] of Object.entries(TOPICS))
      expect(content.check.length, topic).toBeLessThanOrEqual(5)
  })
})
