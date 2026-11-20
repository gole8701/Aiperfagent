import { create } from 'zustand'

import { api, describeError } from '../api/client'
import type { OptionDoc, SettingsResponse } from '../api/types'
import { IS_STATIC } from '../static/env'

interface SettingsState {
  config?: Record<string, unknown>
  schema: OptionDoc[]
  loading: boolean
  error?: { message: string; hint?: string }
  saving: boolean
  load: () => Promise<void>
  /** Sends a partial config (top-level sections) to the server and keeps the merged result. */
  save: (patch: Record<string, unknown>) => Promise<void>
}

export const useSettings = create<SettingsState>((set, get) => ({
  schema: [],
  loading: false,
  saving: false,

  async load() {
    if (IS_STATIC || get().config) return
    set({ loading: true, error: undefined })
    try {
      const data = await api.get<SettingsResponse>('/api/settings')
      set({ config: data.config, schema: data.schema, loading: false })
    } catch (error) {
      set({ error: describeError(error), loading: false })
    }
  },

  async save(patch) {
    set({ saving: true, error: undefined })
    try {
      const data = await api.put<{ config: Record<string, unknown> }>('/api/settings', patch)
      set({ config: data.config, saving: false })
    } catch (error) {
      set({ error: describeError(error), saving: false })
      throw error
    }
  },
}))

/** Reads a dotted path such as "ai.provider" from the config object. */
export function configValue(config: Record<string, unknown> | undefined, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      config,
    )
}

/** Builds the partial patch { a: { b: value } } for a dotted path. */
export function patchFor(path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.')
  const root: Record<string, unknown> = {}
  let cursor = root
  keys.forEach((key, index) => {
    if (index === keys.length - 1) cursor[key] = value
    else {
      const next: Record<string, unknown> = {}
      cursor[key] = next
      cursor = next
    }
  })
  return root
}
