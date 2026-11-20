import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { api, describeError } from '../../api/client'
import type { McpConfig, ProviderStatus, ProvidersResponse } from '../../api/types'
import { onWsMessage } from '../../api/ws'
import { Button, CopyButton } from '../../components/Button'
import { Card, ErrorBox, Progress } from '../../components/Card'
import { Select, TextField, Toggle } from '../../components/Fields'
import { configValue, useSettings } from '../../state/settings'

import { SchemaRows } from './SchemaRows'
import { SettingsShell } from './SettingsShell'

const KEY_PROVIDERS: ProviderStatus['id'][] = [
  'anthropic',
  'openai',
  'gemini',
  'openrouter',
  'openai-compatible',
]
const SIGNED_IN: ProviderStatus['id'][] = ['claude-code', 'codex', 'gemini-cli']
const FREE_MODELS = [
  { value: 'qwen2.5-coder:1.5b', label: 'qwen2.5-coder 1.5B · 1 GB · fast on any laptop' },
  { value: 'qwen2.5-coder:7b', label: 'qwen2.5-coder 7B · 4.7 GB · better fixes, needs 16 GB RAM' },
]
const OPENROUTER_VERIFIER = 'perfagent.openrouter.verifier'
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
  const [notice, setNotice] = useState<string>()

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

  // Back from OpenRouter's login page with a one-time code: swap it for a key on the server.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    const verifier = sessionStorage.getItem(OPENROUTER_VERIFIER)
    if (!code || !verifier) return
    sessionStorage.removeItem(OPENROUTER_VERIFIER)
    const clean = new URL(window.location.href)
    clean.searchParams.delete('code')
    window.history.replaceState(null, '', clean.toString())
    void api
      .post('/api/ai/openrouter', { code, verifier })
      .then(() => save({ ai: { provider: 'openrouter' } }))
      .then(refresh)
      .then(() => setNotice('OpenRouter is connected and in use.'))
      .catch((err: unknown) => setNotice(`OpenRouter: ${describeError(err).message}`))
  }, [])

  if (error) return <ErrorBox error={error} />
  const providers = data?.providers ?? []
  const byId = (id: ProviderStatus['id']) => providers.find((p) => p.id === id)
  const ollama = byId('ollama')
  const lmstudio = byId('lmstudio')
  const openrouter = byId('openrouter')
  const provider = configValue(config, 'ai.provider')
  const active = typeof provider === 'string' ? provider : 'none'
  const use = (id: ProviderStatus['id']) => void save({ ai: { provider: id } })
  const rowProps = {
    active,
    tests,
    onUse: use,
    onTest: (id: ProviderStatus['id']) => void test(id),
  }

  return (
    <div className="settings-grid">
      <Card title="Free · no key" data-tour="defaults">
        <div className="provider-row" style={{ borderTop: 'none' }}>
          <span>Built-in rules</span>
          <span className="badge badge-good">ON · always</span>
        </div>
        <ProviderRow
          {...rowProps}
          p={ollama}
          label={`Local AI (Ollama${ollama?.models[0] ? `: ${ollama.models[0]}` : ''})`}
          fallback={
            ollama?.detail?.startsWith('running') ? (
              <DownloadModel onDone={refresh} />
            ) : (
              <InstallOllama hint={ollama?.installHint} />
            )
          }
        />
        <ProviderRow
          {...rowProps}
          p={lmstudio}
          fallback={
            <a className="btn btn-sm" href="https://lmstudio.ai" target="_blank" rel="noreferrer">
              Get LM Studio
            </a>
          }
        />
        <BrowserAi />
      </Card>

      <Card title="Use the AI you already pay for · no key" data-tour="providers">
        {SIGNED_IN.map((id) => (
          <ProviderRow
            key={id}
            {...rowProps}
            p={byId(id)}
            fallback={
              byId(id)?.installHint ? <InstallHint command={byId(id)?.installHint ?? ''} /> : null
            }
          />
        ))}
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          PerfAgent asks the tool you are signed in to, so it uses your own plan. It runs with its
          file and command tools switched off, in an empty folder: it only sees the text PerfAgent
          sends.
        </p>
      </Card>

      <Card title="Cloud AI">
        <ProviderRow
          {...rowProps}
          p={openrouter}
          label="OpenRouter (hundreds of models, one login)"
          fallback={
            <Button small variant="primary" onClick={() => void startOpenRouterLogin()}>
              Connect with OpenRouter
            </Button>
          }
          onRemove={() =>
            void api
              .delete('/api/ai/keys/openrouter')
              .then(refresh)
              .catch((err: unknown) => setError(describeError(err)))
          }
        />
        {notice ? (
          <div className="muted" role="status" style={{ fontSize: 13, marginTop: 6 }}>
            {notice}
          </div>
        ) : null}
        <details style={{ marginTop: 10 }}>
          <summary>Advanced: paste an API key</summary>
          {providers
            .filter((p) => KEY_PROVIDERS.includes(p.id) && p.id !== 'openrouter')
            .map((p) => (
              <ProviderRow
                key={p.id}
                {...rowProps}
                p={p}
                fallback={<span className="muted">no key</span>}
                onRemove={() =>
                  void api
                    .delete(`/api/ai/keys/${p.id}`)
                    .then(refresh)
                    .catch((err: unknown) => setError(describeError(err)))
                }
              />
            ))}
          <AddProvider
            providers={providers.filter((p) => KEY_PROVIDERS.includes(p.id))}
            onAdded={refresh}
          />
        </details>
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

function ProviderRow({
  p,
  label,
  active,
  tests,
  fallback,
  onUse,
  onTest,
  onRemove,
}: {
  p?: ProviderStatus
  label?: string
  active: string
  tests: Record<string, string>
  fallback: ReactNode
  onUse: (id: ProviderStatus['id']) => void
  onTest: (id: ProviderStatus['id']) => void
  onRemove?: () => void
}) {
  if (!p) return null
  return (
    <div className="provider-row">
      <span>
        {label ?? p.label}
        <div className="muted" style={{ fontSize: 12 }}>
          {p.detail ?? (p.configured ? 'ready' : 'not set up')}
        </div>
      </span>
      <span className="row">
        {p.configured ? (
          <>
            <Button
              small
              variant={active === p.id ? 'default' : 'primary'}
              onClick={() => onUse(p.id)}
            >
              {active === p.id ? 'In use' : 'Use it'}
            </Button>
            <Button small onClick={() => onTest(p.id)}>
              Test
            </Button>
            {onRemove ? (
              <Button small variant="danger" onClick={onRemove}>
                Remove
              </Button>
            ) : null}
          </>
        ) : (
          fallback
        )}
        {tests[p.id] ? <span className="muted">{tests[p.id]}</span> : null}
      </span>
    </div>
  )
}

function InstallHint({ command }: { command: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="row">
      <Button small onClick={() => setOpen((v) => !v)}>
        How to get it
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

/** Ollama is running but has no model: download one from here, progress arrives over the WebSocket. */
function DownloadModel({ onDone }: { onDone: () => Promise<void> }) {
  const [model, setModel] = useState(FREE_MODELS[0]?.value ?? '')
  const [progress, setProgress] = useState<{ fraction: number; status: string; error?: boolean }>()
  useEffect(
    () =>
      onWsMessage((m) => {
        if (m.type !== 'ai:pull' || m.model !== model) return
        setProgress({ fraction: m.fraction, status: m.status, error: m.error })
        if (m.done && !m.error) void onDone()
      }),
    [model, onDone],
  )
  const running = progress && !progress.error && progress.status !== 'done'
  return (
    <span className="stack" style={{ gap: 6, flex: '1 1 100%' }}>
      <Select label="Free model" value={model} options={FREE_MODELS} onChange={setModel} />
      {running ? (
        <Progress fraction={progress.fraction} label={`Downloading ${model}: ${progress.status}`} />
      ) : (
        <span className="row">
          <Button
            small
            variant="primary"
            onClick={() => {
              setProgress({ fraction: 0, status: 'starting' })
              void api
                .post('/api/ai/pull', { model })
                .catch((err: unknown) =>
                  setProgress({ fraction: 0, status: describeError(err).message, error: true }),
                )
            }}
          >
            Download free model
          </Button>
          {progress?.error ? <span className="sev-critical">{progress.status}</span> : null}
        </span>
      )}
    </span>
  )
}

/** OpenRouter's PKCE login: no key to copy; the user signs in there and comes back connected. */
async function startOpenRouterLogin(): Promise<void> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  sessionStorage.setItem(OPENROUTER_VERIFIER, verifier)
  const back = `${window.location.origin}/settings/ai`
  window.location.assign(
    `https://openrouter.ai/auth?callback_url=${encodeURIComponent(back)}&code_challenge=${base64Url(new Uint8Array(digest))}&code_challenge_method=S256`,
  )
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
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
            {c.oneClick ? `⚡ ${c.label}` : c.label}
          </Button>
        ))}
      </div>
      {chosen && client ? (
        <div className="stack" style={{ marginTop: 10, gap: 8 }}>
          <OneClick id={client} client={chosen} />
          <details open={!chosen.oneClick}>
            <summary className="muted" style={{ fontSize: 12 }}>
              {chosen.oneClick ? 'Or set it up by hand' : 'Set it up by hand'}
            </summary>
            <div className="stack" style={{ marginTop: 6, gap: 6 }}>
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
          </details>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Pick your assistant. Those marked ⚡ connect in one click; your assistant then uses
          PerfAgent with your own account.
        </div>
      )}
    </Card>
  )
}

function OneClick({ id, client }: { id: string; client: McpConfig }) {
  const [state, setState] = useState<{ busy?: boolean; message?: string; error?: string }>({})
  if (client.oneClick === 'link' && client.link)
    return (
      <div className="row">
        <a className="btn btn-primary" href={client.link}>
          Connect to {client.label}
        </a>
        <span className="muted" style={{ fontSize: 12 }}>
          {client.label} opens and asks you to approve PerfAgent.
        </span>
      </div>
    )
  if (client.oneClick !== 'install') return null
  return (
    <div className="row">
      <Button
        variant="primary"
        busy={state.busy}
        onClick={() => {
          setState({ busy: true })
          api
            .post<{ message: string }>('/api/ai/mcp-connect', { client: id })
            .then((r) => setState({ message: r.message }))
            .catch((err: unknown) => {
              const e = describeError(err)
              setState({ error: e.hint ? `${e.message}. ${e.hint}` : e.message })
            })
        }}
      >
        Connect to {client.label}
      </Button>
      {state.message ? <span style={{ color: 'var(--good)' }}>✔ {state.message}</span> : null}
      {state.error ? <span className="sev-critical">{state.error}</span> : null}
    </div>
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
