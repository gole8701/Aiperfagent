import { useEffect, useRef, useState } from 'react'

import { api, describeError, saveBlob } from '../api/client'
import { Button } from '../components/Button'
import { useReport } from '../state/report'
import { IS_STATIC } from '../static/env'

const FORMATS: { format: 'json' | 'csv' | 'md' | 'html'; label: string }[] = [
  { format: 'json', label: 'JSON (re-importable)' },
  { format: 'csv', label: 'CSV' },
  { format: 'md', label: 'Markdown (PR comment)' },
  { format: 'html', label: 'Single HTML file' },
]

export function ExportMenu() {
  const report = useReport((s) => s.report)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function run(action: () => Promise<void>): Promise<void> {
    setOpen(false)
    setError(undefined)
    try {
      await action()
    } catch (err) {
      setError(describeError(err).message)
    }
  }

  async function png(): Promise<void> {
    const { toPng } = await import('html-to-image')
    const main = document.getElementById('main')
    if (!main) return
    const dataUrl = await toPng(main, { backgroundColor: getComputedStyle(document.body).backgroundColor, cacheBust: true })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'perfagent-screen.png'
    link.click()
  }

  return (
    <div className="menu" ref={ref}>
      <Button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        Export
      </Button>
      {open ? (
        <div className="menu-list" role="menu">
          {report
            ? FORMATS.filter((f) => !IS_STATIC || f.format === 'json').map((f) => (
                <button
                  key={f.format}
                  role="menuitem"
                  onClick={() =>
                    void run(async () => {
                      if (IS_STATIC) saveBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `perfagent-report-${report.id}.json`)
                      else await api.download(`/api/export/${report.id}?format=${f.format}`, `perfagent-report-${report.id}.${f.format}`)
                    })
                  }
                >
                  {f.label}
                </button>
              ))
            : null}
          <button role="menuitem" onClick={() => void run(png)}>
            PNG of this screen
          </button>
          <button role="menuitem" onClick={() => void run(async () => window.print())}>
            PDF (print)
          </button>
        </div>
      ) : null}
      {error ? (
        <span role="alert" className="sev-critical" style={{ fontSize: 12, marginLeft: 8 }}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
