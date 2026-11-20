import type { Page } from 'playwright-core'

/**
 * Agent readiness: how easily an AI browser or assistant can use this page.
 * Checks the accessibility tree, structured data, llms.txt and page size in tokens.
 */
export interface ReadinessSignals {
  agentReadiness: number
  missingLabels: number
  interactiveWithoutName: number
  hasLlmsTxt: boolean
  hasStructuredData: boolean
  pageTokens: number
}

export async function collectReadiness(page: Page, url: string): Promise<ReadinessSignals> {
  const inPage = await page
    .evaluate(() => {
      const name = (el: Element): string =>
        (
          el.getAttribute('aria-label') ??
          el.getAttribute('aria-labelledby') ??
          el.getAttribute('title') ??
          el.textContent
        ).trim()
      const controls = [
        ...document.querySelectorAll(
          'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea',
        ),
      ]
      const unnamed = controls.filter((el) => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          return (
            !el.labels?.length &&
            !el.getAttribute('aria-label') &&
            !el.getAttribute('placeholder') &&
            !el.getAttribute('title')
          )
        }
        return name(el).length === 0 && !el.querySelector('img[alt]')
      })
      const images = [...document.images].filter((img) => !img.alt).length
      const text = document.body.innerText || ''
      return {
        controls: controls.length,
        unnamed: unnamed.length,
        images,
        hasJsonLd: Boolean(document.querySelector('script[type="application/ld+json"]')),
        headings: document.querySelectorAll('h1, h2').length,
        textLength: text.length,
        hasMain: Boolean(document.querySelector('main, [role="main"]')),
      }
    })
    .catch(() => ({
      controls: 0,
      unnamed: 0,
      images: 0,
      hasJsonLd: false,
      headings: 0,
      textLength: 0,
      hasMain: false,
    }))

  const hasLlmsTxt = await page.request
    .get(new URL('/llms.txt', url).toString(), { timeout: 4000 })
    .then((r) => r.ok() && (r.headers()['content-type'] ?? '').includes('text'))
    .catch(() => false)

  const unnamedRatio = inPage.controls ? inPage.unnamed / inPage.controls : 0
  let score = 100
  score -= Math.round(unnamedRatio * 45)
  score -= Math.min(15, inPage.images * 2)
  if (!inPage.hasJsonLd) score -= 15
  if (!hasLlmsTxt) score -= 10
  if (!inPage.hasMain) score -= 5
  if (inPage.headings === 0) score -= 10
  const pageTokens = Math.round(inPage.textLength / 4)
  if (pageTokens > 8000) score -= 10
  return {
    agentReadiness: Math.max(0, Math.min(100, score)),
    missingLabels: inPage.images,
    interactiveWithoutName: inPage.unnamed,
    hasLlmsTxt,
    hasStructuredData: inPage.hasJsonLd,
    pageTokens,
  }
}
