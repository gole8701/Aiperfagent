import { useState, type ReactNode } from 'react'

import { api, describeError } from '../api/client'
import type { ImportResult } from '../api/types'
import { importStaticJson } from '../static/data'
import { IS_STATIC } from '../static/env'
import { Button } from './Button'

interface ImportDropProps {
  onImported: (result: ImportResult) => void
  children?: ReactNode
  compact?: boolean
}

/** Drop zone + file picker for reports. The server reads any format; the website reads PerfAgent and Lighthouse JSON. */
export function ImportDrop({ onImported, children, compact }: ImportDropProps) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function handle(file: File): Promise<void> {
    setBusy(true)
    setError(undefined)
    try {
      if (IS_STATIC) {
        const report = importStaticJson(await file.text(), file.name)
        onImported({ reportId: report.id, format: 'json', exact: true, warnings: [], report })
      } else {
        onImported(await api.upload<ImportResult>('/api/import', file, file.name))
      }
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      style={compact ? { padding: 10 } : undefined}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        const file = event.dataTransfer.files[0]
        if (file) void handle(file)
      }}
    >
      {children ?? (
        <div>
          Drop your <strong>perfagent-report.json</strong>{IS_STATIC ? ' or Lighthouse JSON' : ', Lighthouse JSON, HAR, PDF, Excel or Word report'} here
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
          {busy ? 'Reading…' : 'Choose a file'}
          <input
            type="file"
            className="sr-only"
            accept={IS_STATIC ? '.json' : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handle(file)
              event.target.value = ''
            }}
          />
        </label>
      </div>
      {error ? (
        <div role="alert" className="sev-critical" style={{ marginTop: 8 }}>
          {error}{' '}
          <Button small variant="link" onClick={() => setError(undefined)}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  )
}
