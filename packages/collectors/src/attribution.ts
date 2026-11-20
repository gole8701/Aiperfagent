import type { RequestInfo } from '@perfagent/core'

import type { InjectedState } from './inject.js'

type Task = InjectedState['longTasks'][number]
type Frame = InjectedState['loaf'][number]

export interface AttributedTask extends Task {
  fn?: string
  line?: number
}

/**
 * Names the script behind each long task: the task's own attribution, else the
 * long animation frame that contains it, else the script request that finished
 * just before it started.
 */
export function attributeTasks(
  tasks: Task[],
  frames: Frame[],
  requests: RequestInfo[],
): AttributedTask[] {
  const scripts = requests
    .filter((r) => r.type === 'script')
    .map((r) => ({ url: r.url, end: r.startMs + r.durationMs }))
    .sort((a, b) => b.end - a.end)
  return tasks.map((t) => {
    if (t.script) return t
    const frame = frames.find(
      (f) => f.script && f.startMs <= t.startMs + 1 && t.startMs < f.startMs + f.durationMs,
    )
    if (frame) return { ...t, script: frame.script, fn: frame.fn, line: frame.line }
    // shortcut: request times are only roughly aligned with the page clock, so this is a best guess; drop it if LoAF coverage is enough.
    const loaded = scripts.find((s) => s.end <= t.startMs)
    return loaded ? { ...t, script: loaded.url } : t
  })
}
