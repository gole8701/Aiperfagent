import { METRICS, formatMetric, metricValue, type MetricId } from '@perfagent/core'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import type { GuideDoc, GuideMeta } from '../../api/types'
import { CopyButton, LinkButton } from '../../components/Button'
import { Card, Empty, Spinner } from '../../components/Card'
import { Select, Toggle } from '../../components/Fields'
import { useReport } from '../../state/report'

import { Walkthrough } from './Walkthrough'
import { fetchGuide, fetchGuides, GROUP_ORDER, LANGUAGES, type Language } from './guides-api'
import { parseGuide } from './markdown'
import './guide.css'

const LANG_KEY = 'perfagent.guide.language'

export default function GuideScreen() {
  const { topic } = useParams()
  const [guides, setGuides] = useState<GuideMeta[]>()
  const [query, setQuery] = useState('')
  const [expert, setExpert] = useState(false)
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem(LANG_KEY) as Language | null) ?? 'en')
  const [bodies, setBodies] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchGuides().then(setGuides).catch(() => setGuides([]))
  }, [])

  // Body search: topics load lazily the first time the visitor types.
  useEffect(() => {
    if (!query || !guides || Object.keys(bodies).length) return
    void Promise.all(guides.map((g) => fetchGuide(g.topic, 'en').then((d) => [g.topic, d?.body ?? ''] as const))).then((pairs) => setBodies(Object.fromEntries(pairs)))
  }, [query, guides, bodies])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (guides ?? []).filter((g) => !q || g.title.toLowerCase().includes(q) || g.summary.toLowerCase().includes(q) || (bodies[g.topic] ?? '').toLowerCase().includes(q))
  }, [guides, query, bodies])
  const groups = useMemo(() => {
    const names = [...GROUP_ORDER, ...new Set(filtered.map((g) => g.group).filter((g) => !GROUP_ORDER.includes(g)))]
    return names.map((name) => ({ name, topics: filtered.filter((g) => g.group === name) })).filter((g) => g.topics.length)
  }, [filtered])

  if (!guides) {
    return (
      <div className="page">
        <Spinner label="Loading the guide" />
      </div>
    )
  }

  return (
    <div className="page guide">
      <div className="page-head">
        <div>
          <h1>Guide</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {guides.length} guides · every metric and every feature explained, with written steps and an animated walkthrough.
          </div>
        </div>
        <div className="row no-print">
          <div role="group" aria-label="Level" className="row" style={{ gap: 0 }}>
            <Toggle label={expert ? 'Expert' : 'Beginner'} checked={expert} onChange={setExpert} />
          </div>
          <Select
            label="Language"
            hideLabel
            value={language}
            options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
            onChange={(v) => {
              setLanguage(v as Language)
              localStorage.setItem(LANG_KEY, v)
            }}
          />
        </div>
      </div>
      <div className="guide-layout">
        <aside className="guide-list">
          <input className="input" type="search" placeholder="Search the guide (MCP, LCP, fix…)" aria-label="Search the guide" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: '100%' }} />
          {groups.length === 0 ? <Empty>No guide matches “{query}”.</Empty> : null}
          {groups.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <div className="label" style={{ margin: '14px 0 4px' }}>
                {group.name}
              </div>
              {group.topics.map((g) => (
                <Link key={g.topic} to={`/guide/${g.topic}`} className={`guide-link ${g.topic === topic ? 'active' : ''}`} aria-current={g.topic === topic || undefined}>
                  {g.title}
                </Link>
              ))}
            </section>
          ))}
        </aside>
        <div className="guide-body">
          {topic ? <Topic topic={topic} guides={guides} language={language} expert={expert} /> : <Intro guides={guides} />}
        </div>
      </div>
    </div>
  )
}

function Intro({ guides }: { guides: GuideMeta[] }) {
  const first = guides[0]
  return (
    <Card>
      <h2>Pick a topic</h2>
      <p>Each guide tells you what something is, why it matters, how to do it in PerfAgent step by step, and plays an animated walkthrough across the real screens.</p>
      {first ? <LinkButton to={`/guide/${first.topic}`} variant="primary">Start with “{first.title}” ›</LinkButton> : <span className="muted">No guides were found. Add Markdown files to docs/guides.</span>}
    </Card>
  )
}

function Topic({ topic, guides, language, expert }: { topic: string; guides: GuideMeta[]; language: Language; expert: boolean }) {
  const [doc, setDoc] = useState<(GuideDoc & { translated: boolean }) | null>()
  const [step, setStep] = useState(0)
  const report = useReport((s) => s.report)

  useEffect(() => {
    setDoc(undefined)
    setStep(0)
    void fetchGuide(topic, language).then((d) => setDoc(d ?? null))
  }, [topic, language])

  if (doc === undefined) return <Spinner label="Loading topic" />
  if (doc === null) {
    return (
      <Card>
        <h2>No guide called “{topic}” yet</h2>
        <p className="muted">Pick another topic from the list.</p>
      </Card>
    )
  }
  const parsed = parseGuide(doc.body)
  const index = guides.findIndex((g) => g.topic === topic)
  const next = guides[index + 1]
  const metric = doc.metric && doc.metric in METRICS ? (doc.metric as MetricId) : undefined
  const sections = parsed.sections.filter((s) => expert || !s.expert)

  return (
    <div className="stack">
      <Card>
        <div className="label">{doc.group}</div>
        <h2 style={{ fontSize: '1.4em' }}>{doc.title}</h2>
        <p>{doc.summary}</p>
        {!doc.translated ? <div className="badge badge-warning">Not translated yet: showing English</div> : null}
        {doc.tryIt ? (
          <LinkButton to={doc.tryIt} variant="primary">
            Try it ›
          </LinkButton>
        ) : null}
      </Card>
      {metric ? <MetricBar metric={metric} value={report ? metricValue(report.pages[0]?.metrics ?? [], metric) : undefined} /> : null}
      {parsed.walkthrough.length ? <Walkthrough title={doc.title} steps={parsed.walkthrough} step={step} onStep={setStep} nextTopic={next ? { topic: next.topic, title: next.title } : undefined} /> : null}
      {sections.map((section, i) => (
        <Card key={i} title={section.title || undefined}>
          {/* Markdown is sanitised with DOMPurify in renderMarkdown before it gets here. */}
          <div className="markdown" dangerouslySetInnerHTML={{ __html: section.html }} />
          {/commands|config/i.test(section.title) && parsed.commands.length ? (
            <div className="stack" style={{ marginTop: 8 }}>
              {parsed.commands.map((cmd, j) => (
                <div key={j} className="row" style={{ alignItems: 'flex-start' }}>
                  <CopyButton text={cmd} />
                </div>
              ))}
            </div>
          ) : null}
          {/step/i.test(section.title) && parsed.walkthrough.length ? (
            <ol className="written-steps">
              {parsed.walkthrough.map((s, j) => (
                <li key={j}>
                  <button type="button" className={`btn-link btn ${j === step ? 'active' : ''}`} onClick={() => setStep(j)} aria-current={j === step || undefined}>
                    {s.title}
                  </button>
                  <span className="muted"> · screen: {s.screen}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      ))}
      {next ? (
        <Link to={`/guide/${next.topic}`} className="btn">
          Next guide: {next.title} ›
        </Link>
      ) : null}
    </div>
  )
}

function MetricBar({ metric, value }: { metric: MetricId; value?: number }) {
  const m = METRICS[metric]
  if (m.good === null || m.poor === null) return null
  const max = Math.max(m.poor * 1.5, value ?? 0)
  const pct = (v: number): number => Math.min(100, (v / max) * 100)
  const lower = m.lowerIsBetter
  return (
    <Card title="Good · needs work · poor">
      <div className="metric-bar" role="img" aria-label={`${m.name}: good ${lower ? '≤' : '≥'} ${formatMetric(metric, m.good)}, poor ${lower ? '>' : '<'} ${formatMetric(metric, m.poor)}${value !== undefined ? `, you: ${formatMetric(metric, value)}` : ''}`}>
        <div className="zone" style={{ width: `${pct(lower ? m.good : m.poor)}%`, background: lower ? 'var(--good)' : 'var(--critical)' }} />
        <div className="zone" style={{ width: `${pct(lower ? m.poor : m.good) - pct(lower ? m.good : m.poor)}%`, background: 'var(--warning)' }} />
        <div className="zone" style={{ flex: 1, background: lower ? 'var(--critical)' : 'var(--good)' }} />
        {value !== undefined ? (
          <div className="you" style={{ left: `${pct(value)}%` }}>
            <span>you · {formatMetric(metric, value)}</span>
          </div>
        ) : null}
      </div>
      <div className="row muted" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 18 }}>
        <span>Good {lower ? '≤' : '≥'} {formatMetric(metric, m.good)}</span>
        <span>Needs work</span>
        <span>Poor {lower ? '>' : '<'} {formatMetric(metric, m.poor)}</span>
      </div>
    </Card>
  )
}
