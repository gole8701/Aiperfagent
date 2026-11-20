import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { api, describeError } from '../../api/client'
import type { McpConfig, ProviderStatus, ProvidersResponse } from '../../api/types'
import { Button, CopyButton } from '../../components/Button'
import { Card, ErrorBox } from '../../components/Card'
import { Select, TextField, Toggle } from '../../components/Fields'
import { configValue, useSettings } from '../../state/settings'

import { SchemaRows } from './SchemaRows'
import { SettingsShell } from './SettingsShell'

const KEY_PROVIDERS: ProviderStatus['id'][] = ['anthropic', 'openai', 'openai-compatible', 'gemini']
const ROLE_KEY = 'perfagent.ai.roles'
const BROWSER_AI_KEY = 'perfagent.ai.browser'

export default function AiSettings() {
  return (
    <SettingsShell active="ai" title="AI connections">
      <AiBody />
    </SettingsShell>
  )
}

function AiBody() {
  const { config, save } = useSettings()
  const [data, setData] = useState<ProvidersResponse>()
  const [error, setError] = useState<{ message: string; hint?: string }>()
  const [tests, setTests] = useState<Record<string, string>>({})

  const refresh = (): Promise<void> =>
    api
      .get<ProvidersResponse>('/api/ai/providers')
      .then(setData)
      .catch((err: unknown) => setError(describeError(err)))
  useEffect(() => {
    void refresh()
  }, [])

  async function test(
    provider: ProviderStatus['id'],
    model?: string,
    baseUrl?: string,
  ): Promise<void> {
    setTests({ ...tests, [provider]: 'testing…' })
    try {
      const r = await api.post<{ ok: boolean; message: string; latencyMs: number }>(
        '/api/ai/test',
        { provider, model, baseUrl },
      )
      setTests({ ...tests, [provider]: r.ok ? `OK · ${r.latencyMs} ms` : `Failed: ${r.message}` })
    } catch (err) {
      setTests({ ...tests, [provider]: `Failed: ${describeError(err).message}` })
    }
  }

  if (error) return <ErrorBox error={error} />
  const providers = data?.providers ?? []
  const ollama = providers.find((p) => p.id === 'ollama')
  const provider = configValue(config, 'ai.provider')
  const active = typeof provider === 'string' ? provider : 'none'

  return (
    <div className="settings-grid">
      <Card title="Default (free)" data-tour="defaults">
        <div className="provider-row" style={{ borderTop: 'none' }}>
          <span>Built-in rules</span>
          <span className="badge badge-good">ON · always</span>
        </div>
        <div className="provider-row">
          <span>
            Local AI (Ollama{ollama?.models[0] ? `: ${ollama.models[0]}` : ''})
            <div className="muted" style={{ fontSize: 12 }}>
              {ollama?.detail ?? (ollama?.configured ? 'running' : 'not installed')}
            </div>
          </span>
          <span className="row">
            {ollama?.configured ? (
              <Button
                small
                variant={active === 'ollama' ? 'default' : 'primary'}
                onClick={() => void save({ ai: { provider: 'ollama' } })}
              >
                {active === 'ollama' ? 'In use' : 'Use it'}
              </Button>
            ) : (
              <InstallOllama hint={ollama?.installHint} />
            )}
            <Button small onClick={() => void test('ollama')}>
              Test
            </Button>
            {tests.ollama ? <span className="muted">{tests.ollama}</span> : null}
          </span>
        </div>
        <BrowserAi />
      </Card>

      <Card title="Your AI providers (API key)" data-tour="providers">
        {providers
          .filter((p) => KEY_PROVIDERS.includes(p.id))
          .map((p) => (
            <div key={p.id} className="provider-row">
              <span>
                {p.label}
                <div className="muted" style={{ fontSize: 12 }}>
                  {p.configured
                    ? `key ${p.detail ?? '••••'} · stored in your OS keychain`
                    : 'no key'}
                </div>
              </span>
              <span className="row">
                {p.configured ? (
                  <>
                    <Button
                      small
                      variant={active === p.id ? 'default' : 'primary'}
                      onClick={() => void save({ ai: { provider: p.id } })}
                    >
                      {active === p.id ? 'In use' : 'Use it'}
                    </Button>
                    <Button small onClick={() => void test(p.id)}>
                      Test
                    </Button>
                    <Button
                      small
                      variant="danger"
                      onClick={() =>
                        void api
                          .delete(`/api/ai/keys/${p.id}`)
                          .then(refresh)
                          .catch((err: unknown) => setError(describeError(err)))
                      }
                    >
                      Remove
                    </Button>
                  </>
                ) : null}
                {tests[p.id] ? <span className="muted">{tests[p.id]}</span> : null}
              </span>
            </div>
          ))}
        <AddProvider
          providers={providers.filter((p) => KEY_PROVIDERS.includes(p.id))}
          onAdded={refresh}
        />
      </Card>

      <McpSection />

      <Card title="Which AI does what">
        <Roles
          providers={providers}
          active={active}
          onFixProvider={(id) => void save({ ai: { provider: id } })}
        />
      </Card>

      <Card title="Limits & privacy" data-tour="limits">
        <SchemaRows
          include={(p) =>
            [
              'ai.monthlyBudgetUsd',
              'ai.maxPerFixUsd',
              'ai.sendCode',
              'ai.redact',
              'ai.auditLog',
              'ai.logPrompts',
              'ai.budgetUsdPerDay',
              'ai.model',
              'ai.baseUrl',
            ].includes(p)
          }
          labels={{
            'ai.monthlyBudgetUsd': 'Monthly budget ($)',
            'ai.maxPerFixUsd': 'Max per fix ($)',
            'ai.sendCode': 'Send to AI',
            'ai.redact': 'Remove secrets before sending',
            'ai.auditLog': 'Keep an audit log',
            'ai.logPrompts': 'Store prompts of measured AI calls',
            'ai.budgetUsdPerDay': 'Daily AI budget line ($)',
            'ai.model': 'Model',
            'ai.baseUrl': 'Base URL (company endpoint)',
          }}
        />
        {data ? (
          <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Usage this month: ${data.usage.monthUsd.toFixed(2)} · {data.usage.calls} calls · active:{' '}
            {data.active}
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function InstallOllama({ hint }: { hint?: string }) {
  const [open, setOpen] = useState(false)
  const command =
    hint ?? 'curl -fsSL https://ollama.com/install.sh | sh && ollama pull qwen2.5-coder'
  return (
    <span className="row">
      <Button small variant="primary" onClick={() => setOpen((v) => !v)}>
        Install free local AI
      </Button>
      {open ? (
        <span className="row" style={{ flex: '1 1 100%' }}>
          <pre style={{ flex: 1 }}>{command}</pre>
          <CopyButton text={command} />
        </span>
      ) : null}
    </span>
  )
}

function BrowserAi() {
  const available = typeof navigator !== 'undefined' && 'gpu' in navigator
  const [on, setOn] = useState(localStorage.getItem(BROWSER_AI_KEY) === '1')
  return (
    <div className="provider-row">
      <span>
        In-browser AI (WebGPU)
        <div className="muted" style={{ fontSize: 12 }}>
          {available
            ? 'runs a small model in this browser, nothing leaves your machine'
            : 'not available: this browser has no WebGPU'}
        </div>
      </span>
      <Toggle
        label={on ? 'Enabled' : 'Enable'}
        checked={on}
        disabled={!available}
        onChange={(v) => {
          setOn(v)
          localStorage.setItem(BROWSER_AI_KEY, v ? '1' : '0')
        }}
      />
    </div>
  )
}

function AddProvider({
  providers,
  onAdded,
}: {
  providers: ProviderStatus[]
  onAdded: () => Promise<void>
}) {
  const { save } = useSettings()
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<string>(providers[0]?.id ?? 'anthropic')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function add(): Promise<void> {
    setBusy(true)
    setError(undefined)
    try {
      await api.post('/api/ai/keys', { provider, key })
      await save({ ai: { provider, ...(model ? { model } : {}), ...(baseUrl ? { baseUrl } : {}) } })
      setKey('')
      setOpen(false)
      await onAdded()
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 10 }}>
        <Button small onClick={() => setOpen(true)}>
          + Add AI
        </Button>
      </div>
    )
  }
  return (
    <div className="stack" style={{ marginTop: 10, gap: 8 }}>
      <Select
        label="Provider"
        value={provider}
        options={providers.map((p) => ({ value: p.id, label: p.label }))}
        onChange={setProvider}
      />
      <TextField
        label="API key"
        type="password"
        value={key}
        onChange={setKey}
        description="Stored in your OS keychain, never in a file."
      />
      <TextField label="Model (optional)" value={model} onChange={setModel} />
      {provider === 'openai-compatible' ? (
        <TextField
          label="Base URL"
          type="url"
          value={baseUrl}
          onChange={setBaseUrl}
          description="Azure OpenAI, a company proxy or any OpenAI-compatible endpoint"
        />
      ) : null}
      <div className="row">
        <Button variant="primary" busy={busy} disabled={key.length < 8} onClick={() => void add()}>
          Save key
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        {error ? <span className="sev-critical">{error}</span> : null}
      </div>
    </div>
  )
}

function McpSection() {
  const [configs, setConfigs] = useState<Record<string, McpConfig>>({})
  const [client, setClient] = useState<string>()
  useEffect(() => {
    api
      .get<Record<string, McpConfig>>('/api/ai/mcp-config')
      .then(setConfigs)
      .catch(() => setConfigs({}))
  }, [])
  const chosen = client ? configs[client] : undefined
  return (
    <Card title="AI assistants (MCP)" data-tour="mcp">
      <div className="mcp-buttons" role="group" aria-label="Pick your assistant">
        {Object.entries(configs).map(([id, c]) => (
          <Button
            key={id}
            small
            variant={client === id ? 'primary' : 'default'}
            onClick={() => setClient(id)}
          >
            {c.label}
          </Button>
        ))}
      </div>
      {chosen ? (
        <div className="stack" style={{ marginTop: 10, gap: 6 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {chosen.file === 'terminal'
              ? 'Run in your terminal:'
              : chosen.file === 'remote'
                ? 'Remote mode:'
                : `Add to ${chosen.file}:`}
          </div>
          <pre>{chosen.snippet}</pre>
          <div className="row">
            <CopyButton text={chosen.snippet} label="Copy MCP config" />
            <Link to="/guide/connect-mcp">Show setup steps</Link>
          </div>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Pick your assistant to get the exact config to paste.
        </div>
      )}
    </Card>
  )
}

function Roles({
  providers,
  active,
  onFixProvider,
}: {
  providers: ProviderStatus[]
  active: string
  onFixProvider: (id: string) => void
}) {
  const [roles, setRoles] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(ROLE_KEY) ?? '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  const options = [
    { value: 'rules', label: 'Built-in rules (free)' },
    ...providers
      .filter((p) => p.configured || p.free)
      .map((p) => ({ value: p.id, label: `${p.label}${p.free ? ' (free)' : ''}` })),
  ]
  const set = (role: string, value: string): void => {
    const next = { ...roles, [role]: value }
    setRoles(next)
    localStorage.setItem(ROLE_KEY, JSON.stringify(next))
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Select
        label="Explain problems"
        value={roles.explain ?? active}
        options={options}
        onChange={(v) => set('explain', v)}
      />
      <Select
        label="Generate fixes"
        value={active === 'none' ? 'rules' : active}
        options={options}
        onChange={onFixProvider}
      />
      <Select
        label="Summaries / reports"
        value={roles.summary ?? 'rules'}
        options={options}
        onChange={(v) => set('summary', v)}
      />
      <span className="muted" style={{ fontSize: 12 }}>
        “Generate fixes” is saved in the config (ai.provider). The other two are remembered in this
        browser until the config gains per-role providers.
      </span>
    </div>
  )
}
