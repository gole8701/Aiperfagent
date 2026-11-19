import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'

import { extractToken, requestRejection, tokenMatches, type OriginPolicy } from '@perfagent/security'
import { WebSocketServer, type WebSocket } from 'ws'

export type WsMessage =
  | { type: 'scan:progress'; jobId: string; phase: string; message: string; fraction: number }
  | { type: 'scan:done'; jobId: string; reportId: string }
  | { type: 'scan:error'; jobId: string; message: string }
  | { type: 'live:tick'; tick: unknown }
  | { type: 'live:stopped'; reportId?: string }
  | { type: 'fix:event'; runId: string; event: unknown }
  | { type: 'hello'; mode: string }

/** One hub, every connected dashboard tab gets every message. Auth happens at upgrade time. */
export class WsHub {
  private readonly wss = new WebSocketServer({ noServer: true })
  private readonly clients = new Set<WebSocket>()

  constructor(server: Server, private readonly token: string, private readonly policy: OriginPolicy, mode: string) {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = req.url ?? ''
      if (!url.startsWith('/ws')) return
      const rejection = requestRejection(req.headers as Record<string, string | undefined>, policy)
      const given = extractToken(req.headers, url)
      if (rejection || !tokenMatches(this.token, given)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.clients.add(ws)
        ws.on('close', () => this.clients.delete(ws))
        ws.send(JSON.stringify({ type: 'hello', mode } satisfies WsMessage))
      })
    })
  }

  broadcast(message: WsMessage): void {
    const text = JSON.stringify(message)
    for (const client of this.clients) if (client.readyState === client.OPEN) client.send(text)
  }

  get size(): number {
    return this.clients.size
  }

  close(): void {
    for (const client of this.clients) client.close()
    this.wss.close()
  }
}
