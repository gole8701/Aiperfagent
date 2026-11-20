import type { BuildInfo, TreeNode } from '@perfagent/core'

export interface SourceFile {
  /** Relative path, POSIX separators. */
  path: string
  text: string
  sizeBytes: number
  imports: ImportInfo[]
  components: ComponentInfo[]
  functions: FunctionInfo[]
  /** True for .tsx/.jsx files that render JSX. */
  hasJsx: boolean
}

export interface ImportInfo {
  /** Raw specifier, e.g. `date-fns` or `./CartSummary`. */
  source: string
  /** Resolved relative path for local imports, undefined for packages. */
  resolved?: string
  namespace: boolean
  defaultImport?: string
  named: string[]
  line: number
  /** `import()` / `React.lazy` / `next/dynamic`. */
  dynamic: boolean
}

export interface ComponentInfo {
  name: string
  line: number
  endLine: number
  memoized: boolean
  hooks: HookCall[]
  elements: ElementInfo[]
  /** Local components rendered only inside a `cond && <X/>` or ternary. */
  conditionalChildren: string[]
}

export interface HookCall {
  name: string
  line: number
  /** For useEffect: whether a cleanup function is returned. */
  hasCleanup?: boolean
  /** Identifiers used inside the hook body, e.g. setInterval, addEventListener. */
  calls: string[]
}

export interface ElementInfo {
  tag: string
  line: number
  attributes: Record<string, string | true>
}

export interface FunctionInfo {
  name: string
  line: number
  endLine: number
  async: boolean
  /** Sequential `await x()` call names in body order. */
  awaits: { callee: string; line: number; inLoop: boolean }[]
  calls: { callee: string; line: number; argsText: string }[]
}

export interface ProjectScan {
  root: string
  files: SourceFile[]
  tree: TreeNode
  build: BuildInfo
  packages: Record<string, string>
  framework: Framework
  /** Static assets like CSS and HTML that rules also look at. */
  assets: { path: string; text: string; sizeBytes: number }[]
  stats: { files: number; components: number; elements: number; durationMs: number }
}

export type Framework =
  | 'next'
  | 'react'
  | 'vue'
  | 'nuxt'
  | 'svelte'
  | 'angular'
  | 'astro'
  | 'remix'
  | 'plain'
