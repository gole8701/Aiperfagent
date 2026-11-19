/** Contract stub: the real watchAI wrapper replaces this file. */
export interface WatchOptions {
  /** Where to send samples; defaults to the local PerfAgent server. */
  endpoint?: string
  logPrompts?: boolean
}

export function watchAI<T>(client: T, _options: WatchOptions = {}): T {
  return client
}
