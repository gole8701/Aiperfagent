import type { SourceLocation } from '@perfagent/core'
import { useState } from 'react'

import { api, describeError } from '../../api/client'
import type { EditorOpenResult, Status } from '../../api/types'
import { Button, CopyButton } from '../../components/Button'
import { Select } from '../../components/Fields'
import { useSettings } from '../../state/settings'

interface EditorOpenProps {
  location: SourceLocation
  status?: Status
  label?: string
}

/** "Open in editor at this line" with the editor dropdown; "Copy file:line" when the server cannot open files. */
export function EditorOpen({
  location,
  status,
  label = 'Open in editor at this line',
}: EditorOpenProps) {
  const { config, save } = useSettings()
  const [result, setResult] = useState<EditorOpenResult>()
  const [busy, setBusy] = useState(false)
  const fileLine = `${location.file}:${location.line}`
  const editors = status?.editors ?? {}
  const configured = config?.editor ?? status?.config.editor
  const editor = typeof configured === 'string' ? configured : 'auto'

  if (!status?.capabilities.openEditor) {
    return (
      <div className="row">
        <span className="mono">{fileLine}</span>
        <CopyButton text={fileLine} label="Copy file:line" />
      </div>
    )
  }

  async function open(): Promise<void> {
    setBusy(true)
    try {
      setResult(
        await api.post<EditorOpenResult>('/api/editor/open', {
          file: location.file,
          line: location.line,
          column: location.column,
          editor,
        }),
      )
    } catch (error) {
      setResult({
        opened: false,
        message: describeError(error).message,
        hint: describeError(error).hint,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row">
        <Select
          label="Editor"
          hideLabel
          value={editor}
          options={Object.entries(editors).map(([value, name]) => ({ value, label: name }))}
          onChange={(value) => void save({ editor: value }).catch(() => undefined)}
        />
        <Button variant="primary" onClick={() => void open()} busy={busy}>
          {label}
        </Button>
        <CopyButton text={fileLine} label="Copy path" />
      </div>
      {result ? (
        <div
          role="status"
          className={result.opened ? 'rating-good' : 'sev-warning'}
          style={{ fontSize: 13 }}
        >
          {result.message}
          {result.hint ? <span className="muted"> {result.hint}</span> : null}
          {!result.opened && result.fallbackUrl ? (
            <>
              {' '}
              <a href={result.fallbackUrl}>Open with the editor link</a>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
