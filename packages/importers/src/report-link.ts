/** True for a single pasted URL that points at a PerfAgent dashboard or shared report; the server fetches those. */
export function looksLikeReportLink(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return /\/(reports?|share|compare)\/[\w-]+|\.json$/i.test(url.pathname) || /(^|[?&#])report=/i.test(url.search + url.hash)
  } catch {
    return false
  }
}
