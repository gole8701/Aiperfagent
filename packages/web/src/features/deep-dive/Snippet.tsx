import type { SourceLocation } from '@perfagent/core'
import { useEffect, useState } from 'react'

import { api } from '../../api/client'
import type { Snippet as SnippetData } from '../../api/types'

interface SnippetProps {
  location: SourceLocation
  /** Code captured at scan time, shown when the live file cannot be read. */
  fallback?: string
  canReadFiles: boolean
}

/** Source window around the problem line, read live from disk in local mode. */
export function Snippet({ location, fallback, canReadFiles }: SnippetProps) {
  const [data, setData] = useState<SnippetData>()

  useEffect(() => {
    setData(undefined)
    if (!canReadFiles) return
    let cancelled = false
    api
      .get<SnippetData>(`/api/files/snippet?file=${encodeURIComponent(location.file)}&line=${location.line}&radius=6`)
      .then((s) => {
        if (!cancelled) setData(s)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [location.file, location.line, canReadFiles])

  if (!data) return fallback ? <pre aria-label="Code at the problem line">{fallback}</pre> : null
  return (
    <pre aria-label={`Code around line ${location.line} of ${location.file}`} style={{ padding: 0 }}>
      {data.lines.map((line, index) => {
        const number = data.startLine + index
        const isTarget = number === location.line
        return (
          <div key={number} style={{ display: 'flex', gap: 10, padding: '0 10px', background: isTarget ? 'color-mix(in srgb, var(--critical) 18%, transparent)' : undefined }}>
            <span className="muted" style={{ width: 36, textAlign: 'right', flex: '0 0 auto', userSelect: 'none' }} aria-hidden="true">
              {number}
            </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{line || ' '}</span>
          </div>
        )
      })}
    </pre>
  )
}
