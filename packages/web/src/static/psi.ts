import type { Report } from '@perfagent/core'

import { addStaticReport } from './data'
import { convertLighthouse, isLighthouseJson } from './lighthouse'

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

/** Quick test on the website: Google runs Lighthouse, we show the result through the same converter. */
export async function quickTest(url: string): Promise<Report> {
  const target = new URL(PSI_ENDPOINT)
  target.searchParams.set('url', url)
  target.searchParams.set('strategy', 'mobile')
  target.searchParams.set('category', 'performance')
  const response = await fetch(target.toString())
  const data: unknown = await response.json()
  if (!response.ok) {
    const message = (data as { error?: { message?: string } }).error?.message ?? `PageSpeed Insights failed (${response.status})`
    throw new Error(message)
  }
  if (!isLighthouseJson(data)) throw new Error('PageSpeed Insights returned no Lighthouse result')
  return addStaticReport({ ...convertLighthouse(data), label: `PageSpeed · ${url}` })
}
