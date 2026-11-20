import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { installMcpClient, mcpClients, type McpLaunch } from '../src/mcp-clients.js'

const LAUNCH: McpLaunch = { command: '/usr/bin/node', args: ['/x/bin.js', 'mcp', '--root', '/p'] }
let home: string
let oldHome: string | undefined

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'perfagent-home-'))
  oldHome = process.env.HOME
  process.env.HOME = home
})
afterEach(async () => {
  process.env.HOME = oldHome
  await rm(home, { recursive: true, force: true })
})

const windsurfFile = (): string => path.join(home, '.codeium', 'windsurf', 'mcp_config.json')

describe('one-click MCP connect', () => {
  it('builds deep links that carry the exact launch command', () => {
    const clients = mcpClients(LAUNCH)
    const cursor = new URL(clients.cursor?.link ?? '')
    expect(
      JSON.parse(Buffer.from(cursor.searchParams.get('config') ?? '', 'base64').toString()),
    ).toEqual(LAUNCH)
    const vscode = clients.copilot?.link ?? ''
    expect(JSON.parse(decodeURIComponent(vscode.slice('vscode:mcp/install?'.length)))).toEqual({
      name: 'perfagent',
      ...LAUNCH,
    })
  })

  it('adds itself to a new config file', async () => {
    await installMcpClient('windsurf', LAUNCH)
    expect(JSON.parse(await readFile(windsurfFile(), 'utf8'))).toEqual({
      mcpServers: { perfagent: LAUNCH },
    })
  })

  it('keeps other servers and settings, and backs the old file up', async () => {
    const before = { theme: 'dark', mcpServers: { other: { command: 'x' } } }
    await mkdir(path.dirname(windsurfFile()), { recursive: true })
    await writeFile(windsurfFile(), JSON.stringify(before))
    await installMcpClient('windsurf', LAUNCH)
    expect(JSON.parse(await readFile(windsurfFile(), 'utf8'))).toEqual({
      theme: 'dark',
      mcpServers: { other: { command: 'x' }, perfagent: LAUNCH },
    })
    expect(JSON.parse(await readFile(`${windsurfFile()}.perfagent-backup`, 'utf8'))).toEqual(before)
  })

  it('leaves a file it cannot parse untouched', async () => {
    await mkdir(path.dirname(windsurfFile()), { recursive: true })
    await writeFile(windsurfFile(), '{ // comment\n}')
    await expect(installMcpClient('windsurf', LAUNCH)).rejects.toThrow(/left untouched/)
    expect(await readFile(windsurfFile(), 'utf8')).toBe('{ // comment\n}')
  })

  it('refuses clients without a one-click install', async () => {
    await expect(installMcpClient('zed', LAUNCH)).rejects.toThrow(/no one-click/)
    await expect(installMcpClient('../../etc', LAUNCH)).rejects.toThrow(/no one-click/)
  })
})
