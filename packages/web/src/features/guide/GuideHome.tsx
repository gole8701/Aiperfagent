import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'

import { Empty } from '../../components/Card'

import { Icon } from './Icon'
import { shotUrl } from './ShotTour'
import type { CheckStep } from './content'
import { DIAGRAMS, DiagramFrame } from './diagrams'
import { groupEntries, type Entry } from './entries'
import { SHOTS } from './shots'

const GROUP_INTRO: Record<string, string> = {
  'Get started': 'Install, run your first scan and test any address.',
  Explore: 'Find problems, see where they live and prove your fixes.',
  Metrics: 'What each speed number means, with good and poor limits.',
  Live: 'Watch the page while it runs, from anywhere.',
  AI: 'Measure the AI in your app, and let AI help you fix things.',
}

export function GuideHome({
  entries,
  query,
  search,
  language,
}: {
  entries: Entry[]
  query: string
  search: ReactNode
  language: ReactNode
}) {
  return (
    <>
      <header className="guide-hero">
        <div>
          <h1>Guide</h1>
          <p>
            Every metric and every screen in plain words: what it is, a moving picture of the idea,
            and real screenshots that show exactly where to click.
          </p>
        </div>
        <div className="guide-hero-tools">
          {search}
          {language}
        </div>
      </header>
      {entries.length === 0 ? <Empty>No guide matches “{query}”.</Empty> : null}
      {groupEntries(entries).map((group) => (
        <section key={group.name} aria-label={group.name} className="guide-section">
          <h2>{group.name}</h2>
          {GROUP_INTRO[group.name] ? <p className="muted">{GROUP_INTRO[group.name]}</p> : null}
          <div className="guide-grid">
            {group.entries.map((entry) => (
              <Link key={entry.topic} to={`/guide/${entry.topic}`} className="guide-card">
                <Thumbnail topic={entry.topic} step={entry.content?.check[0]} />
                <span className="guide-card-title">
                  {entry.content ? <Icon name={entry.content.icon} size={18} /> : null}
                  {entry.title}
                </span>
                <span className="guide-card-line">{entry.content?.line ?? entry.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

const ZOOM = 2.2

/** The topic's diagram, small; or a zoomed crop of its first screenshot with a pulsing ring. */
function Thumbnail({ topic, step }: { topic: string; step?: CheckStep }) {
  const diagram = DIAGRAMS[topic]
  if (diagram) {
    return (
      <span className="guide-thumb" aria-hidden="true">
        <DiagramFrame
          small
          duration={diagram.duration}
          still={diagram.still}
          label=""
          render={(p) => <diagram.Component p={p} />}
        />
      </span>
    )
  }
  const box = step ? SHOTS[step.shot]?.[step.at] : undefined
  if (!step || !box) return <span className="guide-thumb" aria-hidden="true" />
  // Centre the control, but never scroll past the edge of the screenshot.
  const edge = 50 / ZOOM
  const clamp = (v: number) => Math.min(100 - edge, Math.max(edge, v))
  const cx = clamp(box.x + box.w / 2)
  const cy = clamp(box.y + box.h / 2)
  const stage: CSSProperties = {
    transform: `scale(${ZOOM}) translate(${50 - cx}%, ${50 - cy}%)`,
  }
  return (
    <span className="guide-thumb" aria-hidden="true">
      <span className="thumb-stage" style={stage}>
        <img
          src={shotUrl(step.shot)}
          alt=""
          loading="lazy"
          decoding="async"
          width={1440}
          height={900}
        />
        <span
          className="thumb-ring"
          style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
        />
      </span>
    </span>
  )
}
