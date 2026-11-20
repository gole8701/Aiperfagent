import { METRICS, metricValue, type MetricId } from '@perfagent/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import type { GuideDoc } from '../../api/types'
import { CopyButton, LinkButton } from '../../components/Button'
import { Card, Spinner } from '../../components/Card'
import { useReport } from '../../state/report'

import { Icon } from './Icon'
import { ShotTour } from './ShotTour'
import { ThresholdBar } from './ThresholdBar'
import { TOPICS } from './content'
import { DIAGRAMS, DiagramFrame } from './diagrams'
import { fetchGuide, LANGUAGES, stripTranslations, type Language } from './guides-api'
import { parseGuide } from './markdown'

/** Markdown sections the structured page already covers; the rest go under "More detail". */
const COVERED = /^(What it is|Why it matters|Good, needs work, poor|How to do it in PerfAgent)/

export function TopicPage({
  topic,
  language,
  next,
}: {
  topic: string
  language: Language
  next?: { topic: string; title: string }
}) {
  const [doc, setDoc] = useState<(GuideDoc & { translated: boolean }) | null>()
  const report = useReport((s) => s.report)

  useEffect(() => {
    setDoc(undefined)
    void fetchGuide(topic, language).then((d) => setDoc(d ?? null))
  }, [topic, language])

  if (doc === undefined) return <Spinner label="Loading topic" />
  if (doc === null) {
    return (
      <Card>
        <h2>No guide called “{topic}” yet</h2>
        <p className="muted">
          Pick another topic from the list or go back to the <Link to="/guide">guide home</Link>.
        </p>
      </Card>
    )
  }

  const content = TOPICS[topic]
  const diagram = DIAGRAMS[topic]
  const metric = doc.metric && doc.metric in METRICS ? (doc.metric as MetricId) : undefined
  const value = metric && report ? metricValue(report.pages[0]?.metrics ?? [], metric) : undefined
  const sections =
    language === 'en'
      ? parseGuide(stripTranslations(doc.body)).filter((s) => !COVERED.test(s.title))
      : parseGuide(doc.body)
  const translated = language !== 'en' && doc.translated

  return (
    <article className="topic stack">
      <header className="card topic-head">
        <div className="topic-kicker">
          {content ? <Icon name={content.icon} /> : null}
          <span>{content?.group ?? doc.group}</span>
        </div>
        <h2>{doc.title}</h2>
        <p className="topic-what">{content?.what ?? doc.summary}</p>
        {content ? (
          <p className="topic-analogy">
            <strong>In everyday life: </strong>
            {content.analogy}
          </p>
        ) : null}
        {content && !metric && !diagram ? (
          <p className="topic-why topic-why-plain">
            <strong>Why it matters: </strong>
            {content.why}
          </p>
        ) : null}
        <div className="row">
          {doc.tryIt ? (
            <LinkButton to={doc.tryIt} variant="primary">
              Open it in PerfAgent ›
            </LinkButton>
          ) : null}
          {language !== 'en' && !doc.translated ? (
            <span className="badge badge-warning">Not translated yet: showing English</span>
          ) : null}
        </div>
      </header>

      {translated ? (
        <Card title={LANGUAGES.find((l) => l.id === language)?.label}>
          {sections.map((s, i) => (
            // Markdown is sanitised with DOMPurify in renderMarkdown.
            <div key={i} className="markdown" dangerouslySetInnerHTML={{ __html: s.html }} />
          ))}
        </Card>
      ) : null}

      {diagram ? (
        <section className="card" aria-labelledby="see-it">
          <h3 id="see-it" className="topic-h">
            See it
          </h3>
          <DiagramFrame
            duration={diagram.duration}
            still={diagram.still}
            label={diagram.label}
            caption={diagram.label}
            render={(p) => <diagram.Component p={p} />}
          />
        </section>
      ) : null}

      {content && (metric || diagram) ? (
        <section className="card" aria-labelledby="why-it-matters">
          <h3 id="why-it-matters" className="topic-h">
            {metric && METRICS[metric].good !== null ? 'Good, needs work, poor' : 'Why it matters'}
          </h3>
          {metric ? <ThresholdBar metric={metric} value={value} /> : null}
          <p className="topic-why">
            <strong>Why it matters: </strong>
            {content.why}
          </p>
        </section>
      ) : null}

      {content?.check.length ? (
        <div>
          <h3 className="topic-h">How to check it in PerfAgent</h3>
          <ShotTour key={topic} steps={content.check} title={doc.title} />
        </div>
      ) : null}

      {content?.test?.length ? (
        <section className="card" aria-labelledby="test-it">
          <h3 id="test-it" className="topic-h">
            How to test it on your own page
          </h3>
          <ol className="test-steps">
            {content.test.map((step, i) => (
              <li key={i}>
                <p>{step.text}</p>
                {step.code ? (
                  <div className="test-code">
                    <pre>
                      <code>{step.code}</code>
                    </pre>
                    <CopyButton text={step.code} />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {content?.causes?.length ? (
        <section className="card" aria-labelledby="causes">
          <h3 id="causes" className="topic-h">
            Common causes and their fixes
          </h3>
          <ul className="causes">
            {content.causes.map((c) => (
              <li key={c.cause}>
                <span className="cause">{c.cause}</span>
                <span className="cause-arrow" aria-hidden="true">
                  →
                </span>
                <span className="cause-fix">{c.fix}</span>
                {c.rule ? <code className="cause-rule">{c.rule}</code> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!translated && sections.length ? (
        <details className="card topic-more" open={!content}>
          <summary>More detail, commands and links</summary>
          {sections.map((s, i) => (
            <div key={i}>
              {s.title ? <h4>{s.title}</h4> : null}
              {/* Markdown is sanitised with DOMPurify in renderMarkdown. */}
              <div className="markdown" dangerouslySetInnerHTML={{ __html: s.html }} />
            </div>
          ))}
        </details>
      ) : null}

      {next ? (
        <Link to={`/guide/${next.topic}`} className="btn topic-next">
          Next: {next.title} ›
        </Link>
      ) : null}
    </article>
  )
}
