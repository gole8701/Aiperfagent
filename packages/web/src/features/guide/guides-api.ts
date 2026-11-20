import { api } from '../../api/client'
import type { GuideDoc, GuideMeta } from '../../api/types'
import { loadStaticGuide, loadStaticGuides } from '../../static/data'
import { IS_STATIC } from '../../static/env'

export type Language = 'en' | 'hi' | 'mr'
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी (Hindi)' },
  { id: 'mr', label: 'मराठी (Marathi)' },
]

export function fetchGuides(): Promise<GuideMeta[]> {
  return IS_STATIC ? loadStaticGuides() : api.get<GuideMeta[]>('/api/guides')
}

/**
 * Loads a topic in the chosen language. The server serves one file per topic;
 * translations live either in `## Hindi` / `## Marathi` sections of that file or
 * in `<topic>.hi.md` files on the static site. When neither exists the English
 * text is returned with `translated: false` so the UI can say so.
 */
export async function fetchGuide(
  topic: string,
  language: Language,
): Promise<(GuideDoc & { translated: boolean }) | undefined> {
  const safe = topic.replace(/[^a-z0-9-]/gi, '')
  if (IS_STATIC) {
    const doc = await loadStaticGuide(safe, language)
    if (!doc) return undefined
    const english = language === 'en' ? doc : await loadStaticGuide(safe, 'en')
    const localized =
      language === 'en'
        ? doc.body
        : doc.body !== english?.body
          ? doc.body
          : sectionFor(doc.body, language)
    return {
      ...doc,
      body: localized ?? doc.body,
      translated: language === 'en' || localized !== undefined,
    }
  }
  const doc = await api.get<GuideDoc>(`/api/guides/${safe}`).catch(() => undefined)
  if (!doc) return undefined
  const localized =
    language === 'en'
      ? doc.body
      : ((await api.get<GuideDoc>(`/api/guides/${safe}.${language}`).catch(() => undefined))
          ?.body ?? sectionFor(doc.body, language))
  return {
    ...doc,
    body: localized ?? stripTranslations(doc.body),
    translated: language === 'en' || localized !== undefined,
  }
}

// Guides head their translations in English or in the language itself.
const SECTION_NAME: Record<Language, string> = {
  en: 'English',
  hi: '(?:Hindi|हिन्दी)',
  mr: '(?:Marathi|मराठी)',
}

/** Extracts a `## Hindi` (or `## Marathi`) section from a guide, if the author wrote one. */
export function sectionFor(body: string, language: Language): string | undefined {
  const match = new RegExp(
    `^## ${SECTION_NAME[language]}\\s*$([\\s\\S]*?)(?=^## (?:English|Hindi|Marathi|हिन्दी|मराठी)\\s*$|(?![\\s\\S]))`,
    'm',
  ).exec(body)
  const text = match?.[1]?.trim()
  return text ? text : undefined
}

export function stripTranslations(body: string): string {
  return body
    .replace(/^## (Hindi|Marathi|हिन्दी|मराठी)\s*$[\s\S]*?(?=^## |(?![\s\S]))/gm, '')
    .trim()
}
