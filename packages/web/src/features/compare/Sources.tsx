import type { HistoryPoint } from '@perfagent/core'
import { useState } from 'react'

import { Button } from '../../components/Button'
import { Select } from '../../components/Fields'
import { ImportDrop } from '../../components/ImportDrop'
import { IS_STATIC } from '../../static/env'

import { describeSource, type SourceSpec } from './types'

interface SourceCardProps {
  label: string
  source: SourceSpec
  scans: HistoryPoint[]
  onChange: (source: SourceSpec) => void
  onRemove?: () => void
}

type Picker = 'saved' | 'url' | 'file' | 'text' | 'link'

const PICKERS: { id: Picker; label: string }[] = [
  { id: 'saved', label: 'Saved scans' },
  { id: 'url', label: 'Test a URL now' },
  { id: 'file', label: 'Upload file' },
  { id: 'text', label: 'Paste text' },
  { id: 'link', label: 'Dashboard link' },
]

/** One source (A, B, C…): saved scan, fresh URL scan, dropped file, pasted text or a dashboard/report link. */
export function SourceCard({ label, source, scans, onChange, onRemove }: SourceCardProps) {
  const [picker, setPicker] = useState<Picker>('saved')
  const [text, setText] = useState('')
  const pickers = IS_STATIC
    ? PICKERS.filter((p) => p.id === 'saved' || p.id === 'url' || p.id === 'file')
    : PICKERS

  return (
    <div className="card source-card">
      <div className="card-title">
        <strong>{label}</strong>
        <span className="row">
          <span className="badge">{describeSource(source)}</span>
          {onRemove ? (
            <Button small onClick={onRemove} aria-label={`Remove source ${label}`}>
              ✕
            </Button>
          ) : null}
        </span>
      </div>
      <div
        className="row"
        style={{ marginBottom: 8 }}
        role="tablist"
        aria-label={`How to add source ${label}`}
      >
        {pickers.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={picker === p.id}
            onClick={() => setPicker(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {picker === 'saved' ? (
        <Select
          label={`Saved scan for ${label}`}
          hideLabel
          value={source.kind === 'report' ? source.reportId : ''}
          options={[
            { value: '', label: 'Pick a saved scan' },
            ...scans.map((s) => ({
              value: s.reportId,
              label: `${s.label ?? s.reportId} · ${new Date(s.at).toLocaleString()} · score ${s.score}`,
            })),
          ]}
          onChange={(id) => {
            const scan = scans.find((s) => s.reportId === id)
            if (scan)
              onChange({
                kind: 'report',
                reportId: id,
                title: `${scan.label ?? id} · ${new Date(scan.at).toLocaleDateString()}`,
              })
          }}
        />
      ) : null}
      {picker === 'url' || picker === 'link' ? (
        <div className="row">
          <input
            className="input"
            type="url"
            style={{ flex: 1 }}
            aria-label={picker === 'url' ? 'URL to test now' : 'Dashboard or report link'}
            placeholder={
              picker === 'url'
                ? 'https://your-site.com/checkout'
                : 'http://127.0.0.1:4545/?report=… or …/report.json'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={() => text && onChange({ kind: picker, url: text })}>
            {picker === 'url' ? 'Use this URL' : 'Use link'}
          </Button>
        </div>
      ) : null}
      {picker === 'file' ? (
        <ImportDrop
          compact
          onImported={(result) =>
            onChange({ kind: 'file', result, title: result.report.label ?? result.format })
          }
        />
      ) : null}
      {picker === 'text' ? (
        <div className="stack" style={{ gap: 6 }}>
          <textarea
            className="input"
            aria-label="Pasted report text"
            placeholder="Paste a table, a Lighthouse JSON or any report text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={() => text && onChange({ kind: 'text', text })}>Use this text</Button>
        </div>
      ) : null}
    </div>
  )
}
