import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { PerfAgentError } from '@perfagent/core'

const run = promisify(execFile)

export interface McpLaunch {
  command: string
  args: string[]
}

/**
 * How `connect` is offered for a client:
 * - `link`: a deep link; the assistant itself asks the user to approve the server
 * - `install`: PerfAgent adds itself to the assistant's own config (after the user clicks)
 * - absent: copy the snippet by hand
 */
export interface McpClient {
  label: string
  file: string
  snippet: string
  oneClick?: 'link' | 'install'
  link?: string
  /** Shown after a one-click install. */
  after?: string
}

export const NPX_LAUNCH: McpLaunch = { command: 'npx', args: ['-y', 'perfagent', 'mcp'] }

/**
 * The command assistants should run. From npx or a global install the published name is
 * stable; from a local build it is this exact node + bin, so it works before any npm publish.
 */
export function currentLaunch(root: string): McpLaunch {
  const bin = process.argv[1]
  if (!bin || /[\\/](_npx|node_modules)[\\/]/.test(bin))
    return { command: 'npx', args: [...NPX_LAUNCH.args, '--root', root] }
  return { command: process.execPath, args: [bin, 'mcp', '--root', root] }
}

const json = (value: unknown): string => JSON.stringify(value, null, 2)

/** Formats change; these match each tool's docs at the time of release. */
export function mcpClients(launch: McpLaunch): Record<string, McpClient> {
  const server = { command: launch.command, args: launch.args }
  const mcpServers = json({ mcpServers: { perfagent: server } })
  const quoted = [launch.command, ...launch.args].map((a) => (/\s/.test(a) ? `"${a}"` : a))
  return {
    'claude-code': {
      label: 'Claude Code',
      file: 'terminal',
      snippet: `claude mcp add --scope user perfagent -- ${quoted.join(' ')}`,
      oneClick: 'install',
      after: 'Added for every project. Start a new Claude Code session and ask "scan my app".',
    },
    'claude-desktop': {
      label: 'Claude Desktop',
      file: 'claude_desktop_config.json',
      snippet: mcpServers,
      oneClick: 'install',
      after: 'Added. Quit and reopen Claude Desktop to see the PerfAgent tools.',
    },
    cursor: {
      label: 'Cursor',
      file: '.cursor/mcp.json',
      snippet: mcpServers,
      oneClick: 'link',
      link: `cursor://anysphere.cursor-deeplink/mcp/install?name=perfagent&config=${Buffer.from(JSON.stringify(server)).toString('base64')}`,
    },
    copilot: {
      label: 'VS Code + GitHub Copilot',
      file: '.vscode/mcp.json',
      snippet: json({ servers: { perfagent: server } }),
      oneClick: 'link',
      link: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'perfagent', ...server }))}`,
    },
    windsurf: {
      label: 'Windsurf',
      file: '~/.codeium/windsurf/mcp_config.json',
      snippet: mcpServers,
      oneClick: 'install',
      after: 'Added. Press "Refresh" in Windsurf\'s MCP panel or restart Windsurf.',
    },
    cline: { label: 'Cline', file: 'cline_mcp_settings.json', snippet: mcpServers },
    zed: {
      label: 'Zed',
      file: 'settings.json',
      snippet: json({
        context_servers: { perfagent: { command: { path: launch.command, args: launch.args } } },
      }),
    },
    chatgpt: {
      label: 'ChatGPT (connectors)',
      file: 'remote',
      snippet:
        'PERFAGENT_MCP_TOKEN=<long-random-token> npx perfagent mcp --http --port 4546\n' +
        '# ChatGPT needs a remote HTTPS endpoint: put this behind an HTTPS tunnel or proxy\n' +
        '# that sends "Authorization: Bearer $PERFAGENT_MCP_TOKEN", then add https://<tunnel>/mcp',
    },
  }
}

/** The npx snippets, as documented in docs/mcp.md. */
export const MCP_CONFIGS = mcpClients(NPX_LAUNCH)

function desktopConfigFile(): string {
  const home = os.homedir()
  if (process.platform === 'darwin')
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  if (process.platform === 'win32')
    return path.join(
      process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'),
      'Claude',
      'claude_desktop_config.json',
    )
  return path.join(home, '.config', 'Claude', 'claude_desktop_config.json')
}

const CONFIG_FILES: Record<string, () => string> = {
  'claude-desktop': desktopConfigFile,
  windsurf: () => path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
}

/**
 * One-click install for clients with a known config location. Only fixed client ids, fixed
 * paths and the server's own launch command are used; nothing from the request reaches a
 * path or a command line.
 */
export async function installMcpClient(client: string, launch: McpLaunch): Promise<string> {
  const info = mcpClients(launch)[client]
  if (info?.oneClick !== 'install')
    throw new PerfAgentError(
      'NOT_FOUND',
      'This assistant has no one-click install',
      'Use "Copy config" instead.',
    )

  if (client === 'claude-code') {
    try {
      // Re-adding replaces an older entry (for example one pointing at a moved project).
      await run('claude', ['mcp', 'remove', '--scope', 'user', 'perfagent'], {
        timeout: 15_000,
      }).catch(() => undefined)
      await run(
        'claude',
        ['mcp', 'add', '--scope', 'user', 'perfagent', '--', launch.command, ...launch.args],
        {
          timeout: 15_000,
        },
      )
    } catch (error) {
      throw new PerfAgentError(
        'AI_NOT_CONFIGURED',
        'Could not add PerfAgent to Claude Code',
        `${error instanceof Error ? error.message.split('\n')[0] : String(error)}. You can also run: ${info.snippet}`,
      )
    }
    return info.after ?? 'Added.'
  }

  const file = CONFIG_FILES[client]?.()
  if (!file) throw new PerfAgentError('NOT_FOUND', 'Unknown assistant')
  await mergeServer(file, launch)
  return `${info.after ?? 'Added.'} (${file}; the old file was kept as ${path.basename(file)}.perfagent-backup)`
}

/** Adds `mcpServers.perfagent` and keeps every other entry; refuses to touch a file it cannot parse. */
async function mergeServer(file: string, launch: McpLaunch): Promise<void> {
  let parsed: unknown = {}
  let existed = false
  try {
    const text = await readFile(file, 'utf8')
    existed = true
    parsed = text.trim() ? JSON.parse(text) : {}
  } catch (error) {
    if (existed)
      throw new PerfAgentError(
        'CONFIG_INVALID',
        `${path.basename(file)} is not plain JSON, so it was left untouched`,
        'Use "Copy config" and paste the entry by hand.',
      )
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new PerfAgentError(
      'CONFIG_INVALID',
      `${path.basename(file)} has an unexpected shape, so it was left untouched`,
    )
  const current = parsed as { mcpServers?: Record<string, unknown> } & Record<string, unknown>
  current.mcpServers = {
    ...(current.mcpServers ?? {}),
    perfagent: { command: launch.command, args: launch.args },
  }
  await mkdir(path.dirname(file), { recursive: true })
  if (existed) await copyFile(file, `${file}.perfagent-backup`)
  await writeFile(file, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
}
