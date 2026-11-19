import type { SourceLocation } from '@perfagent/core'
import { SourceMapConsumer, type RawSourceMap } from 'source-map-js'

/**
 * Maps a location inside a shipped script back to the original source file.
 * Dev servers (Vite, Next dev) serve modules by their source path, so the URL
 * alone is enough; production bundles need the `.map` file referenced by
 * `//# sourceMappingURL=`.
 */
export type Fetcher = (url: string) => Promise<string | undefined>

export interface BundledPosition {
  url: string
  /** 1-based line and column, or a character offset when `charOffset` is set. */
  line?: number
  column?: number
  charOffset?: number
}

export interface MapperOptions {
  /** Relative project file paths, used to confirm a mapped path really exists. */
  projectFiles: Set<string>
  fetch: Fetcher
}

export class SourceMapper {
  private readonly scripts = new Map<string, Promise<string | undefined>>()
  private readonly maps = new Map<string, Promise<SourceMapConsumer | undefined>>()

  constructor(private readonly options: MapperOptions) {}

  async toSource(position: BundledPosition): Promise<SourceLocation | undefined> {
    const direct = this.directFile(position.url)
    const { line, column } = await this.lineColumn(position)
    if (direct) return { file: direct, line, column, bundled: { file: position.url, line, column } }

    const consumer = await this.consumerFor(position.url)
    if (!consumer) return undefined
    const original = consumer.originalPositionFor({ line, column: Math.max(0, column - 1) })
    if (!original.source) return undefined
    const file = this.projectPath(original.source)
    if (!file) return undefined
    return { file, line: original.line, column: original.column + 1, symbol: original.name === '' ? undefined : original.name, bundled: { file: position.url, line, column } }
  }

  /** `http://localhost:3000/src/components/LiveStock.tsx?t=123` → `src/components/LiveStock.tsx`. */
  directFile(url: string): string | undefined {
    const path = safePath(url)
    if (!path) return undefined
    const candidate = path.replace(/^\/+/, '').replace(/^@fs\/.*?\/(src\/)/, '$1')
    return this.options.projectFiles.has(candidate) ? candidate : undefined
  }

  /** `webpack:///./src/a.tsx`, `../../src/a.tsx`, `/src/a.tsx` → `src/a.tsx` when the file exists. */
  projectPath(source: string): string | undefined {
    const cleaned = source.replace(/^webpack:\/\/\/?/, '').replace(/^(\.\.\/)+/, '').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\?.*$/, '')
    if (this.options.projectFiles.has(cleaned)) return cleaned
    // Source maps often keep only the tail of the path; match on the longest suffix.
    for (const file of this.options.projectFiles) if (cleaned.endsWith(file) || file.endsWith(cleaned)) return file
    return undefined
  }

  private async lineColumn(position: BundledPosition): Promise<{ line: number; column: number }> {
    if (position.charOffset === undefined) return { line: position.line ?? 1, column: position.column ?? 1 }
    const text = await this.script(position.url)
    if (!text) return { line: 1, column: position.charOffset + 1 }
    let line = 1
    let lastBreak = -1
    for (let i = 0; i < position.charOffset && i < text.length; i++) {
      if (text.charCodeAt(i) === 10) {
        line++
        lastBreak = i
      }
    }
    return { line, column: position.charOffset - lastBreak }
  }

  private script(url: string): Promise<string | undefined> {
    let cached = this.scripts.get(url)
    if (!cached) {
      cached = this.options.fetch(url).catch(() => undefined)
      this.scripts.set(url, cached)
    }
    return cached
  }

  private consumerFor(url: string): Promise<SourceMapConsumer | undefined> {
    let cached = this.maps.get(url)
    if (!cached) {
      cached = this.loadMap(url)
      this.maps.set(url, cached)
    }
    return cached
  }

  private async loadMap(url: string): Promise<SourceMapConsumer | undefined> {
    const text = await this.script(url)
    if (!text) return undefined
    const match = /\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/m.exec(text)
    const ref = match?.[1] ?? `${url.split('?')[0] ?? url}.map`
    let raw: string | undefined
    if (ref.startsWith('data:')) {
      const base64 = ref.split(',')[1] ?? ''
      raw = Buffer.from(base64, 'base64').toString('utf8')
    } else {
      raw = await this.options.fetch(new URL(ref, url).toString()).catch(() => undefined)
    }
    if (!raw) return undefined
    try {
      return new SourceMapConsumer(JSON.parse(raw) as RawSourceMap)
    } catch {
      return undefined
    }
  }
}

function safePath(url: string): string | undefined {
  try {
    return new URL(url).pathname
  } catch {
    return undefined
  }
}
