import { create } from 'zustand'

export type Theme = 'dark' | 'light' | 'system' | 'high-contrast'

interface DisplayState {
  theme: Theme
  density: 'comfortable' | 'compact'
  presentation: boolean
  reducedMotion: boolean
  setTheme: (theme: Theme) => void
  setDensity: (density: DisplayState['density']) => void
  setPresentation: (on: boolean) => void
}

const KEY = 'perfagent.display'

function read(): Pick<DisplayState, 'theme' | 'density' | 'presentation'> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DisplayState>
    return {
      theme: saved.theme ?? 'dark',
      density: saved.density ?? 'comfortable',
      presentation: saved.presentation ?? false,
    }
  } catch {
    return { theme: 'dark', density: 'comfortable', presentation: false }
  }
}

const media =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : undefined
const motion =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined

function apply(state: Pick<DisplayState, 'theme' | 'density' | 'presentation'>): void {
  const resolved = state.theme === 'system' ? (media?.matches ? 'light' : 'dark') : state.theme
  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.density = state.density
  root.dataset.presentation = state.presentation ? 'on' : 'off'
  localStorage.setItem(KEY, JSON.stringify(state))
}

export const useDisplay = create<DisplayState>((set, get) => {
  const initial = read()
  apply(initial)
  media?.addEventListener('change', () => apply(get()))
  motion?.addEventListener('change', () => set({ reducedMotion: motion.matches }))
  const update = (patch: Partial<DisplayState>): void => {
    set(patch)
    apply(get())
  }
  return {
    ...initial,
    reducedMotion: Boolean(motion?.matches),
    setTheme: (theme) => update({ theme }),
    setDensity: (density) => update({ density }),
    setPresentation: (presentation) => update({ presentation }),
  }
})

export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
  'high-contrast': 'High contrast',
}

/** Reads a design token at runtime so canvases (globe, charts) follow the theme. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
