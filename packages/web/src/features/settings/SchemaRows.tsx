import { useState } from 'react'

import type { OptionDoc } from '../../api/types'
import { Select, TextField, Toggle } from '../../components/Fields'
import { configValue, patchFor, useSettings } from '../../state/settings'

interface SchemaRowsProps {
  /** Which option paths to show; everything the schema has when omitted. */
  include?: (path: string) => boolean
  labels?: Record<string, string>
}

/** Renders config options straight from the server's schema rows, so a new option appears here with no UI change. */
export function SchemaRows({ include, labels = {} }: SchemaRowsProps) {
  const { schema, config, save, saving } = useSettings()
  const rows = schema.filter((r) => !include || include(r.path))
  if (!rows.length) return <span className="muted">No options.</span>
  return (
    <div className="stack" style={{ gap: 12 }} aria-busy={saving}>
      {rows.map((row) => (
        <OptionRow key={row.path} row={row} value={configValue(config, row.path)} label={labels[row.path] ?? humanise(row.path)} onSave={(value) => save(patchFor(row.path, value)).catch(() => undefined)} />
      ))}
    </div>
  )
}

interface OptionRowProps {
  row: OptionDoc
  value: unknown
  label: string
  onSave: (value: unknown) => void
}

function OptionRow({ row, value, label, onSave }: OptionRowProps) {
  const [draft, setDraft] = useState<string>()
  const text = draft ?? stringify(value ?? row.default, row.type)

  if (row.type === 'boolean') return <Toggle label={label} description={row.description} checked={Boolean(value ?? row.default)} onChange={onSave} />
  if (row.type === 'choice' && row.choices) {
    return (
      <div className="field">
        <Select label={label} value={String(value ?? row.default ?? '')} options={row.choices.map((c) => ({ value: c, label: c }))} onChange={onSave} />
        <span>{row.description}</span>
      </div>
    )
  }
  const commit = (): void => {
    if (draft === undefined) return
    onSave(parse(draft, row.type))
    setDraft(undefined)
  }
  return (
    <TextField
      label={label}
      description={`${row.description}${row.type === 'list' ? ' (comma separated)' : row.type === 'map' ? ' (JSON)' : ''}`}
      type={row.type === 'number' ? 'number' : 'text'}
      value={text}
      onChange={setDraft}
      onBlur={commit}
    />
  )
}

function stringify(value: unknown, type: string): string {
  if (value === undefined || value === null) return ''
  if (type === 'list' && Array.isArray(value)) return value.join(', ')
  if (type === 'map' || typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parse(text: string, type: string): unknown {
  if (type === 'number') return Number(text)
  if (type === 'list') return text.split(',').map((s) => s.trim()).filter(Boolean)
  if (type === 'map' || type === 'choice or list') {
    try {
      return JSON.parse(text)
    } catch {
      return type === 'map' ? {} : text
    }
  }
  return text === '' ? undefined : text
}

function humanise(path: string): string {
  const last = path.split('.').pop() ?? path
  return last.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}
