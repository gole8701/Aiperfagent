/** Short, URL-safe ids. Not cryptographic; tokens come from `@perfagent/security`. */
export function shortId(prefix = ''): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return prefix ? `${prefix}_${time}${rand}` : `${time}${rand}`
}

export function issueId(ruleId: string, file: string | undefined, line: number | undefined, route?: string): string {
  const where = file ? `${file}:${line ?? 0}` : (route ?? 'page')
  return `${ruleId}@${where}`.replace(/[^a-zA-Z0-9@:/._-]/g, '_')
}
