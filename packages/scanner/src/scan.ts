import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import type { PerfAgentConfig } from '@perfagent/config'
import type { TreeNode } from '@perfagent/core'
import { globToRegExp, isBlocked } from '@perfagent/security'

import { parseSource } from './parse.js'
import type { Framework, ProjectScan, SourceFile } from './types.js'

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const ASSET_EXT = new Set(['.css', '.scss', '.html'])
const MAX_FILE_BYTES = 1_500_000

export interface ScanOptions {
  root: string
  include?: string[]
  exclude?: string[]
  maxFiles?: number
  onProgress?: (done: number, total: number) => void
}

export async function scanProject(options: ScanOptions): Promise<ProjectScan> {
  const started = Date.now()
  const root = path.resolve(options.root)
  const exclude = (options.exclude ?? []).map(globToRegExp)
  const include = (options.include ?? []).map((g) =>
    globToRegExp(g.endsWith('/**') ? g : `${g}/**`),
  )
  const paths = await collectPaths(root, root, exclude, include, options.maxFiles ?? 20_000)

  const files: SourceFile[] = []
  const assets: ProjectScan['assets'] = []
  let done = 0
  for (const abs of paths) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
    const ext = path.extname(abs)
    const size = (await stat(abs)).size
    if (size > MAX_FILE_BYTES) continue
    const text = await readFile(abs, 'utf8')
    if (CODE_EXT.has(ext)) files.push(resolveLocalImports(parseSource(rel, text), files.length))
    else if (ASSET_EXT.has(ext)) assets.push({ path: rel, text, sizeBytes: size })
    options.onProgress?.(++done, paths.length)
  }
  const known = new Set(files.map((f) => f.path))
  for (const f of files)
    for (const imp of f.imports) imp.resolved = resolveImport(f.path, imp.source, known)

  const packages = await readDependencies(root)
  const framework = detectFramework(packages)
  const tree = buildTree(root, files, assets)
  return {
    root,
    files,
    assets,
    tree,
    packages,
    framework,
    build: {
      framework,
      frameworkVersion: frameworkVersion(packages, framework),
      dependencies: packages,
    },
    stats: {
      files: files.length + assets.length,
      components: files.reduce((n, f) => n + f.components.length, 0),
      elements: files.reduce(
        (n, f) => n + f.components.reduce((m, c) => m + c.elements.length, 0),
        0,
      ),
      durationMs: Date.now() - started,
    },
  }
}

async function collectPaths(
  root: string,
  dir: string,
  exclude: RegExp[],
  include: RegExp[],
  max: number,
): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (out.length >= max) break
    const abs = path.join(dir, entry.name)
    const rel = path.relative(root, abs).split(path.sep).join('/')
    if (isBlocked(rel) || exclude.some((re) => re.test(rel))) continue
    if (entry.isDirectory())
      out.push(...(await collectPaths(root, abs, exclude, include, max - out.length)))
    else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (!CODE_EXT.has(ext) && !ASSET_EXT.has(ext)) continue
      // Root-level files (config, index.html) are always in; others must match an include glob.
      if (include.length && rel.includes('/') && !include.some((re) => re.test(rel))) continue
      out.push(abs)
    }
  }
  return out
}

function resolveLocalImports(file: SourceFile, _index: number): SourceFile {
  return file
}

function resolveImport(from: string, source: string, known: Set<string>): string | undefined {
  if (!source.startsWith('.') && !source.startsWith('@/') && !source.startsWith('~/'))
    return undefined
  const base = source.startsWith('.')
    ? path.posix.join(path.posix.dirname(from), source)
    : source.replace(/^[@~]\//, 'src/')
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'].map((s) => base + s),
  ]
  return candidates.find((c) => known.has(c))
}

async function readDependencies(root: string): Promise<Record<string, string>> {
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return { ...pkg.devDependencies, ...pkg.dependencies }
  } catch {
    return {}
  }
}

export function detectFramework(deps: Record<string, string>): Framework {
  if ('next' in deps) return 'next'
  if ('nuxt' in deps) return 'nuxt'
  if ('@remix-run/react' in deps) return 'remix'
  if ('astro' in deps) return 'astro'
  if ('@angular/core' in deps) return 'angular'
  if ('svelte' in deps) return 'svelte'
  if ('vue' in deps) return 'vue'
  if ('react' in deps) return 'react'
  return 'plain'
}

function frameworkVersion(deps: Record<string, string>, framework: Framework): string | undefined {
  const key = {
    next: 'next',
    react: 'react',
    vue: 'vue',
    nuxt: 'nuxt',
    svelte: 'svelte',
    angular: '@angular/core',
    astro: 'astro',
    remix: '@remix-run/react',
    plain: '',
  }[framework]
  return key ? deps[key]?.replace(/^[\^~]/, '') : undefined
}

export function buildTree(
  root: string,
  files: SourceFile[],
  assets: ProjectScan['assets'],
): TreeNode {
  const rootName = path.basename(root)
  const node = (
    id: string,
    name: string,
    kind: TreeNode['kind'],
    p: string,
    tag: string,
    line?: number,
  ): TreeNode => ({
    id,
    name,
    kind,
    path: p,
    tag,
    line,
    issueIds: [],
    counts: { critical: 0, warning: 0, info: 0 },
    children: [],
  })
  const tree = node(rootName, rootName, 'root', '', 'ROOT')
  const dirs = new Map<string, TreeNode>([['', tree]])
  const dirFor = (relDir: string): TreeNode => {
    const existing = dirs.get(relDir)
    if (existing) return existing
    const parent = dirFor(path.posix.dirname(relDir) === '.' ? '' : path.posix.dirname(relDir))
    const created = node(`${rootName}/${relDir}`, path.posix.basename(relDir), 'dir', relDir, 'DIR')
    parent.children.push(created)
    dirs.set(relDir, created)
    return created
  }
  for (const f of files) {
    const dir = path.posix.dirname(f.path)
    const fileNode = node(
      `${rootName}/${f.path}`,
      path.posix.basename(f.path),
      'file',
      f.path,
      path.extname(f.path).slice(1).toUpperCase(),
    )
    fileNode.sizeBytes = f.sizeBytes
    fileNode.imports = f.imports.map((i) => i.resolved).filter((r): r is string => Boolean(r))
    for (const c of f.components) {
      const comp = node(`${fileNode.id}#${c.name}`, c.name, 'component', f.path, '<>', c.line)
      for (const el of c.elements.filter((e) => /^[a-z]/.test(e.tag)).slice(0, 60))
        comp.children.push(
          node(`${comp.id}:${el.line}:${el.tag}`, `<${el.tag}>`, 'element', f.path, 'EL', el.line),
        )
      fileNode.children.push(comp)
    }
    for (const fn of f.functions.filter((fn) => !f.components.some((c) => c.name === fn.name)))
      fileNode.children.push(
        node(`${fileNode.id}#${fn.name}`, `${fn.name}()`, 'function', f.path, 'fn', fn.line),
      )
    dirFor(dir === '.' ? '' : dir).children.push(fileNode)
  }
  for (const a of assets) {
    const dir = path.posix.dirname(a.path)
    const n = node(
      `${rootName}/${a.path}`,
      path.posix.basename(a.path),
      'file',
      a.path,
      path.extname(a.path).slice(1).toUpperCase(),
    )
    n.sizeBytes = a.sizeBytes
    dirFor(dir === '.' ? '' : dir).children.push(n)
  }
  sortTree(tree)
  return tree
}

function sortTree(node: TreeNode): void {
  node.children.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : rank(a.kind) - rank(b.kind),
  )
  for (const c of node.children) sortTree(c)
}
function rank(kind: TreeNode['kind']): number {
  return { root: 0, dir: 1, file: 2, component: 3, function: 4, element: 5 }[kind]
}

export function scanOptionsFromConfig(config: PerfAgentConfig): ScanOptions {
  return {
    root: config.root,
    include: config.scan.include,
    exclude: config.scan.exclude,
    maxFiles: config.scan.maxFiles,
  }
}
