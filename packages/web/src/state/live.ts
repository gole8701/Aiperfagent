import type { LiveStats } from '@perfagent/core'
import { create } from 'zustand'

import { api, describeError } from '../api/client'
import type { LiveStopResponse, LiveTick } from '../api/types'
import { onWsMessage } from '../api/ws'

export type LiveWindow = 60 | 900

interface LiveState {
  running: boolean
  url: string
  ticks: LiveTick[]
  window: LiveWindow
  peaks: { at: string; metric: string; value: number }[]
  recording?: { reportId?: string; stats?: LiveStats }
  busy: boolean
  error?: { message: string; hint?: string }
  start: (url: string) => Promise<void>
  stop: () => Promise<void>
  setWindow: (window: LiveWindow) => void
  sync: () => Promise<void>
}

const MAX_TICKS = 900
let unsubscribe: (() => void) | undefined

/** Live session state fed by `live:tick` WebSocket messages; keeps at most 15 minutes of one-second ticks. */
export const useLive = create<LiveState>((set, get) => {
  const listen = (): void => {
    if (unsubscribe) return
    unsubscribe = onWsMessage((message) => {
      if (message.type === 'live:tick') {
        const tick = message.tick
        if (typeof tick.requestsPerSec !== 'number') return
        const ticks = [...get().ticks, tick].slice(-MAX_TICKS)
        const peaks = tick.peak ? [...get().peaks, { at: tick.at, metric: tick.peak.metric, value: tick.peak.value }].slice(-50) : get().peaks
        set({ ticks, peaks })
      }
      if (message.type === 'live:stopped') set({ running: false, recording: { ...get().recording, reportId: message.reportId } })
    })
  }

  return {
    running: false,
    url: '',
    ticks: [],
    window: 60,
    peaks: [],
    busy: false,

    async sync() {
      try {
        const status = await api.get<{ running: boolean; url?: string }>('/api/live/status')
        set({ running: status.running, url: status.url ?? get().url })
        if (status.running) listen()
      } catch {
        // Status is best-effort; the Start button still works.
      }
    },

    async start(url) {
      set({ busy: true, error: undefined, ticks: [], peaks: [], recording: undefined })
      try {
        listen()
        await api.post('/api/live/start', { url })
        set({ running: true, url })
      } catch (error) {
        set({ error: describeError(error) })
      } finally {
        set({ busy: false })
      }
    },

    async stop() {
      set({ busy: true, error: undefined })
      try {
        const result = await api.post<LiveStopResponse>('/api/live/stop')
        set({ running: false, recording: { reportId: result.reportId, stats: result.stats } })
      } catch (error) {
        set({ error: describeError(error) })
      } finally {
        set({ busy: false })
      }
    },

    setWindow: (window) => set({ window }),
  }
})
