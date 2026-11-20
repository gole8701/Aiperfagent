import { METRICS, formatMetric, type DetectedValue } from '@perfagent/core'
import { useState } from 'react'

import { api, describeError } from '../../api/client'
import type { ImportResult } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'

interface DetectedValuesProps {
  result: ImportResult
  onCorrected: (result: ImportResult) => void
}

const LOW = 0.7

/** The "Detected values" check step after a PDF / Word / Excel import. Low-confidence values are highlighted and editable. */
export function DetectedValues({ result, onCorrected }: DetectedValuesProps) {
  const [values, setValues] = useState<DetectedValue[]>(result.detected ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const low = values.filter((v) => v.confidence < LOW)

  async function save(): Promise<void> {
    setBusy(true)
    setError(undefined)
    try {
      const report = await api.post<ImportResult['report']>(
        `/api/import/${result.reportId}/correct`,
        { values: values.map((v) => ({ metric: v.metric, value: v.value, route: v.route })) },
      )
      onCorrected({ ...result, report, detected: values.map((v) => ({ ...v, confidence: 1 })) })
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Detected values · check before trusting the result">
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
        {low.length
          ? `${low.length} value${low.length > 1 ? 's' : ''} read with low confidence (${low.map((v) => METRICS[v.metric].short).join(', ')}). Check and correct them.`
          : 'Every value was read with good confidence.'}
        {result.warnings.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Page</th>
              <th scope="col">Value</th>
              <th scope="col">Confidence</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v, index) => (
              <tr
                key={`${v.metric}-${v.route ?? ''}`}
                style={
                  v.confidence < LOW
                    ? { background: 'color-mix(in srgb, var(--warning) 15%, transparent)' }
                    : undefined
                }
              >
                <td>{METRICS[v.metric].short}</td>
                <td className="mono">{v.route ?? '—'}</td>
                <td>
                  {v.confidence < LOW ? (
                    <input
                      className="input"
                      type="number"
                      step="any"
                      style={{ height: 30, width: 120 }}
                      aria-label={`Corrected ${METRICS[v.metric].short}`}
                      value={v.value}
                      onChange={(e) =>
                        setValues(
                          values.map((x, i) =>
                            i === index ? { ...x, value: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                  ) : (
                    formatMetric(v.metric, v.value)
                  )}
                </td>
                <td className={v.confidence < LOW ? 'sev-warning' : 'rating-good'}>
                  {Math.round(v.confidence * 100)}%
                </td>
                <td className="muted">{v.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {low.length ? (
        <div className="row" style={{ marginTop: 8 }}>
          <Button variant="primary" busy={busy} onClick={() => void save()}>
            Save corrected values
          </Button>
          {error ? <span className="sev-critical">{error}</span> : null}
        </div>
      ) : null}
    </Card>
  )
}
