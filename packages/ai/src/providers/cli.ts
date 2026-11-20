import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { pingProvider, type ChatRequest, type ChatResult, type Provider } from './types.js'

// Long fixes on a busy subscription can take a while; same ceiling as local models.
const CLI_TIMEOUT_MS = 600_000

interface CliSpec {
  bin: string
  /** Arguments for one prompt; the prompt itself always goes in on stdin. */
  args: (request: ChatRequest, outFile: string) => string[]
  /** Pulls the answer (and usage when the tool reports it) out of what the tool wrote. */
  parse: (
    stdout: string,
    outFile: string,
  ) => Promise<Partial<ChatResult> & { text: string }> | (Partial<ChatResult> & { text: string })
}

/**
 * Runs an AI tool the user already signed in to (Claude Code, Codex, Gemini CLI), so
 * PerfAgent uses their subscription and never sees a key. Every run is text in, text
 * out: built-in tools are switched off where the CLI allows it, and the process runs in
 * an empty temp folder, so it cannot read or change the project even if it tried.
 */
function cliProvider(id: Provider['id'], label: string, spec: CliSpec): Provider {
  async function chat(request: ChatRequest): Promise<ChatResult> {
    const started = Date.now()
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'perfagent-ai-'))
    const outFile = path.join(cwd, 'answer.txt')
    try {
      const stdout = await runCli(spec.bin, spec.args(request, outFile), transcript(request), cwd)
      const parsed = await spec.parse(stdout, outFile)
      const totalMs = Date.now() - started
      return {
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        model: request.model || label,
        ...parsed,
        firstTokenMs: totalMs,
        totalMs,
      }
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }

  const provider: Provider = {
    id,
    label,
    free: false,
    defaultModel: '',
    chat,
    listModels: () => Promise.resolve([]),
    test: async () =>
      (await cliInstalled(spec.bin))
        ? pingProvider(provider, {}, '')
        : { ok: false, message: `${label} is not installed on this machine.`, latencyMs: 0 },
  }
  return provider
}

/** CLIs take one prompt, so the system prompt and the conversation become one text. */
function transcript(request: ChatRequest): string {
  const turns = request.messages.map((m) =>
    request.messages.length === 1 ? m.content : `${m.role.toUpperCase()}:\n${m.content}`,
  )
  return `${request.system}\n\n${turns.join('\n\n')}`
}

function runCli(bin: string, args: string[], input: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Fixed binary and argument array, no shell: nothing in the prompt can become a command.
    const child = spawn(bin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${bin} did not answer within ${CLI_TIMEOUT_MS / 60_000} minutes`))
    }, CLI_TIMEOUT_MS)
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`${bin} failed: ${(err || out).trim().slice(-400) || `exit ${code}`}`))
    })
    child.stdin.end(input)
  })
}

/** `<bin> --version` answers quickly and only when the tool is installed and on PATH. */
export function cliInstalled(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, ['--version'], { stdio: 'ignore' })
    const timer = setTimeout(() => {
      child.kill()
      resolve(false)
    }, 5000)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
}

export const claudeCode = cliProvider('claude-code', 'Claude Code (your login)', {
  bin: 'claude',
  args: (r) => [
    '-p',
    '--output-format',
    'json',
    '--tools',
    '',
    '--strict-mcp-config',
    '--no-session-persistence',
    ...(r.model ? ['--model', r.model] : []),
  ],
  parse: (stdout) => {
    const data = JSON.parse(stdout) as {
      result?: string
      is_error?: boolean
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }
      modelUsage?: Record<string, unknown>
    }
    if (data.is_error) throw new Error(data.result ?? 'Claude Code returned an error')
    return {
      text: data.result ?? '',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      cachedTokens: data.usage?.cache_read_input_tokens ?? 0,
      ...(data.modelUsage ? { model: Object.keys(data.modelUsage)[0] } : {}),
    }
  },
})

// shortcut: Codex and Gemini CLI flags follow their docs but were not run here (not installed); test when either is.
export const codex = cliProvider('codex', 'Codex CLI (your ChatGPT login)', {
  bin: 'codex',
  args: (r, outFile) => [
    'exec',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--output-last-message',
    outFile,
    ...(r.model ? ['--model', r.model] : []),
    '-',
  ],
  parse: async (_stdout, outFile) => ({ text: await readFile(outFile, 'utf8') }),
})

export const geminiCli = cliProvider('gemini-cli', 'Gemini CLI (your Google login)', {
  bin: 'gemini',
  args: (r) => [
    '--output-format',
    'json',
    ...(r.model ? ['--model', r.model] : []),
    '-p',
    'Follow the instructions in the input.',
  ],
  parse: (stdout) => {
    const data = JSON.parse(stdout) as { response?: string; error?: { message?: string } }
    if (data.error) throw new Error(data.error.message ?? 'Gemini CLI returned an error')
    return { text: data.response ?? '' }
  },
})

export const CLI_BINS: Partial<Record<Provider['id'], string>> = {
  'claude-code': 'claude',
  codex: 'codex',
  'gemini-cli': 'gemini',
}
