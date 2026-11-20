import { IS_STATIC } from '../static/env'

import { sessionToken } from './client'
import type { FixEvent, LiveTick } from './types'

export type WsMessage =
  | { type: 'scan:progress'; jobId: string; phase: string; message: string; fraction: number }
  | { type: 'scan:done'; jobId: string; reportId: string }
  | { type: 'scan:error'; jobId: string; message: string }
  | { type: 'live:tick'; tick: LiveTick }
  | { type: 'live:stopped'; reportId?: string }
  | { type: 'fix:event'; runId: string; event: FixEvent }
  | { type: 'hello'; mode: string }

type Listener = (message: WsMessage) => void

const listeners = new Set<Listener>()
let socket: WebSocket | undefined
let attempts = 0
let timer: number | undefined

function connect(): void {
  if (IS_STATIC || socket) return
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  socket = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(sessionToken())}`)
  socket.onopen = () => {
    attempts = 0
  }
  socket.onmessage = (event) => {
    let message: WsMessage
    try {
      message = JSON.parse(String(event.data)) as WsMessage
    } catch {
      return
    }
    for (const listener of listeners) listener(message)
  }
  socket.onclose = () => {
    socket = undefined
    if (listeners.size === 0) return
    // Exponential backoff capped at 15 s so a restarted CLI picks the tab back up.
    const delay = Math.min(15_000, 500 * 2 ** attempts++)
    timer = window.setTimeout(connect, delay)
  }
  socket.onerror = () => socket?.close()
}

/** Subscribes to server events; the socket opens with the first listener and closes with the last. */
export function onWsMessage(listener: Listener): () => void {
  listeners.add(listener)
  connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.clearTimeout(timer)
      socket?.close()
      socket = undefined
    }
  }
}
