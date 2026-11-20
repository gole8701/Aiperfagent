import { useState } from 'react'
import { useNavigate } from 'react-router'

import { api, describeError } from '../api/client'
import { Button, LinkButton } from '../components/Button'
import { Progress } from '../components/Card'
import { Select } from '../components/Fields'
import { useReport } from '../state/report'
import { quickTest } from '../static/psi'
import { IS_STATIC } from '../static/env'

/** Top-bar scan controls: environment picker, "Paste any URL", Scan, Live. */
export function ScanBox() {
  const status = useReport((s) => s.status)
  const scan = useReport((s) => s.scan)
  const setScan = useReport((s) => s.setScan)
  const useAsReport = useReport((s) => s.useReport)
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [environment, setEnvironment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const environments = Object.entries(status?.config.environments ?? {})
  const knownUrls = new Set(status?.config.urls ?? [])

  async function start(): Promise<void> {
    setError(undefined)
    setBusy(true)
    try {
      const target = url.trim()
      if (IS_STATIC) {
        if (!target) throw new Error('Paste a public URL to test it with PageSpeed Insights')
        useAsReport(await quickTest(normalise(target)))
        navigate('/')
        return
      }
      const envUrl = environments.find(([name]) => name === environment)?.[1].url
      const body = target ? { urls: [normalise(target)], project: knownUrls.has(normalise(target)), environmentName: environment || undefined } : envUrl ? { urls: [envUrl], environmentName: environment } : {}
      const { jobId } = await api.post<{ jobId: string }>('/api/scans', body)
      setScan({ jobId, phase: 'queued', message: 'Starting scan', fraction: 0 })
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {environments.length ? (
        <Select
          label="Environment"
          hideLabel
          value={environment}
          options={[{ value: '', label: 'Environment: project' }, ...environments.map(([name]) => ({ value: name, label: name }))]}
          onChange={setEnvironment}
        />
      ) : null}
      <input
        className="input"
        type="url"
        aria-label="Paste any URL to test"
        placeholder={IS_STATIC ? 'Quick test any URL (PageSpeed)' : 'Paste any URL to test'}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void start()
        }}
      />
      <Button variant="primary" onClick={() => void start()} busy={busy || (scan !== undefined && !scan.error)} data-tour="scan">
        Scan
      </Button>
      {!IS_STATIC && status?.capabilities.live ? (
        <LinkButton to="/live" variant="danger">
          Live
        </LinkButton>
      ) : null}
      {error ? (
        <span role="alert" className="sev-critical" style={{ fontSize: 12 }}>
          {error}
        </span>
      ) : null}
      {scan ? (
        <div className="scan-progress">
          {scan.error ? (
            <span role="alert" className="sev-critical">
              Scan failed: {scan.error}{' '}
              <Button small onClick={() => setScan(undefined)}>
                Dismiss
              </Button>
            </span>
          ) : (
            <Progress fraction={scan.fraction} label={`${scan.phase}: ${scan.message}`} />
          )}
        </div>
      ) : null}
    </>
  )
}

function normalise(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
