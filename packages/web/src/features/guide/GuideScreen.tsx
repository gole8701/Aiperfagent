import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import type { GuideMeta } from '../../api/types'
import { Empty, Spinner } from '../../components/Card'
import { Select } from '../../components/Fields'

import { GuideHome } from './GuideHome'
import { TopicPage } from './TopicPage'
import { ALIASES } from './content'
import { groupEntries, searchText, toEntries } from './entries'
import { fetchGuide, fetchGuides, LANGUAGES, type Language } from './guides-api'
import './guide.css'

const LANG_KEY = 'perfagent.guide.language'

export default function GuideScreen() {
  const { topic } = useParams()
  const [guides, setGuides] = useState<GuideMeta[]>()
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return (localStorage.getItem(LANG_KEY) as Language | null) ?? 'en'
    } catch {
      return 'en'
    }
  })
  const [bodies, setBodies] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchGuides()
      .then(setGuides)
      .catch(() => setGuides([]))
  }, [])

  // Full-text search: topic bodies load the first time the visitor types.
  useEffect(() => {
    if (!query || !guides || Object.keys(bodies).length) return
    void Promise.all(
      guides.map((g) => fetchGuide(g.topic, 'en').then((d) => [g.topic, d?.body ?? ''] as const)),
    ).then((pairs) => setBodies(Object.fromEntries(pairs)))
  }, [query, guides, bodies])

  const entries = useMemo(() => toEntries(guides ?? []), [guides])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) =>
      [e.title, e.summary, searchText(e.content), bodies[e.topic] ?? ''].some((text) =>
        text.toLowerCase().includes(q),
      ),
    )
  }, [entries, query, bodies])

  const alias = topic ? ALIASES[topic] : undefined
  if (alias) return <Navigate to={`/guide/${alias}`} replace />
  if (!guides) {
    return (
      <div className="page">
        <Spinner label="Loading the guide" />
      </div>
    )
  }

  const search = (
    <input
      className="input guide-search"
      type="search"
      placeholder="Search the guide: LCP, jumps, AI cost, editor…"
      aria-label="Search the guide"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  )
  const languagePicker = (
    <Select
      label="Language"
      hideLabel
      value={language}
      options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
      onChange={(v) => {
        setLanguage(v as Language)
        try {
          localStorage.setItem(LANG_KEY, v)
        } catch {
          // Private windows can refuse storage; the choice still applies for this visit.
        }
      }}
    />
  )

  if (!topic) {
    return (
      <div className="page guide">
        <GuideHome entries={filtered} query={query} search={search} language={languagePicker} />
      </div>
    )
  }

  const index = entries.findIndex((e) => e.topic === topic)
  const next = entries[index + 1]
  return (
    <div className="page guide">
      <div className="guide-layout">
        <aside className="guide-list" aria-label="Guide topics">
          <Link to="/guide" className="guide-home-link">
            ‹ All guides
          </Link>
          {search}
          {filtered.length === 0 ? <Empty>No guide matches “{query}”.</Empty> : null}
          {groupEntries(filtered).map((group) => (
            <section key={group.name} aria-label={group.name}>
              <div className="label guide-group">{group.name}</div>
              {group.entries.map((e) => (
                <Link
                  key={e.topic}
                  to={`/guide/${e.topic}`}
                  className={`guide-link ${e.topic === topic ? 'active' : ''}`}
                  aria-current={e.topic === topic || undefined}
                >
                  {e.title}
                </Link>
              ))}
            </section>
          ))}
          <div className="guide-language">{languagePicker}</div>
        </aside>
        <div className="guide-body">
          <TopicPage
            topic={topic}
            language={language}
            next={next ? { topic: next.topic, title: next.title } : undefined}
          />
        </div>
      </div>
    </div>
  )
}
