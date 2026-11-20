import { create } from 'zustand'

import { api, describeError } from '../api/client'
import type { FixEvent, FixRun, FixScope } from '../api/types'
import { onWsMessage } from '../api/ws'

interface FixState {
  run?: FixRun
  busy: boolean
  error?: { message: string; hint?: string }
  start: (reportId: string, scope: FixScope, options?: { review?: boolean }) => Promise<void>
  accept: (changeIds: string[], edits?: Record<string, string>) => Promise<void>
  skip: (changeIds: string[]) => Promise<void>
  undo: () => Promise<void>
  clear: () => void
}

let unsubscribe: (() => void) | undefined

/** One fix run at a time; events stream in over the WebSocket and append to the run. */
export const useFix = create<FixState>((set, get) => {
  const call = async (work: () => Promise<FixRun | undefined>): Promise<void> => {
    set({ busy: true, error: undefined })
    try {
      const run = await work()
      if (run) set({ run })
    } catch (error) {
      set({ error: describeError(error) })
    } finally {
      set({ busy: false })
    }
  }

  const listen = (): void => {
    unsubscribe?.()
    unsubscribe = onWsMessage((message) => {
      if (message.type !== 'fix:event') return
      const run = get().run
      if (!run || run.id !== message.runId) return
      set({ run: applyEvent(run, message.event) })
    })
  }

  return {
    busy: false,
    start: (reportId, scope, options) =>
      call(async () => {
        listen()
        return api.post<FixRun>('/api/fix/runs', { reportId, scope, review: options?.review })
      }),
    accept: (changeIds, edits) => call(() => api.post<FixRun>(`/api/fix/runs/${get().run?.id}/accept`, { changeIds, edits })),
    skip: (changeIds) => call(() => api.post<FixRun>(`/api/fix/runs/${get().run?.id}/skip`, { changeIds })),
    undo: () => call(() => api.post<FixRun>(`/api/fix/runs/${get().run?.id}/undo`)),
    clear: () => {
      unsubscribe?.()
      unsubscribe = undefined
      set({ run: undefined, error: undefined })
    },
  }
})

function applyEvent(run: FixRun, event: FixEvent): FixRun {
  const next: FixRun = { ...run, events: [...run.events, event] }
  if (event.type === 'proposal') next.pending = [...run.pending, { changeId: event.changeId, issueId: event.issueId, change: event.change }]
  if (event.type === 'applied' || event.type === 'rolled-back') next.pending = run.pending.filter((p) => p.changeId !== event.changeId)
  if (event.type === 'done') next.status = 'done'
  if (event.type === 'error') next.status = 'failed'
  if (event.type === 'proposal' && run.status === 'running') next.status = 'waiting-review'
  return next
}

export function describeEvent(event: FixEvent): string {
  switch (event.type) {
    case 'round':
      return `Round ${event.round}: ${event.message}`
    case 'proposal':
      return `Proposed change to ${event.change.file}`
    case 'applied':
      return `Applied change to ${event.file}`
    case 'check':
      return `${event.ok ? 'Passed' : 'Failed'}: ${event.name}`
    case 'retest':
      return `Re-test: predicted ${Math.round(event.predicted)}, actual ${Math.round(event.actual)}`
    case 'rolled-back':
      return `Rolled back: ${event.reason}`
    case 'done':
      return `Done on branch ${event.summary.branch}: ${event.summary.applied} applied, ${event.summary.skipped} skipped, score ${event.summary.before} → ${event.summary.after}, $${event.summary.costUsd.toFixed(2)}`
    case 'error':
      return `Error: ${event.message}`
  }
}
