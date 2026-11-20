import {
  lineText,
  loc,
  pageMetric,
  replaceLine,
  snippet,
  type Finding,
  type Rule,
} from '../engine.js'

const docs = {
  memo: { label: 'react.dev: memo', url: 'https://react.dev/reference/react/memo' },
  context: {
    label: 'react.dev: Scaling up with context',
    url: 'https://react.dev/learn/scaling-up-with-reducer-and-context',
  },
  effect: {
    label: 'react.dev: useEffect cleanup',
    url: 'https://react.dev/reference/react/useEffect#connecting-to-an-external-system',
  },
  lazy: { label: 'react.dev: lazy', url: 'https://react.dev/reference/react/lazy' },
  bundle: { label: 'Bundlephobia', url: 'https://bundlephobia.com' },
}

const HEAVY_NAMESPACE: Record<string, { sizeKb: number; fix: string }> = {
  'date-fns': { sizeKb: 78, fix: "import { format } from 'date-fns'" },
  lodash: { sizeKb: 72, fix: "import debounce from 'lodash/debounce'" },
  moment: { sizeKb: 290, fix: 'Use Intl.DateTimeFormat or date-fns functions' },
  rxjs: { sizeKb: 45, fix: "import { map } from 'rxjs'" },
  '@mui/icons-material': { sizeKb: 1900, fix: "import Add from '@mui/icons-material/Add'" },
  'react-icons': { sizeKb: 900, fix: "import { FaBeer } from 'react-icons/fa'" },
}

/** 2. Component re-renders on every context change / keystroke. */
export const contextRerender: Rule = {
  id: 'react/context-rerender',
  pack: 'react',
  title: 'Component re-renders on every context change',
  plain: 'Part of the screen redraws on every keystroke',
  severity: 'critical',
  metrics: ['inp'],
  areas: ['re-renders', 'javascript'],
  why: 'useContext subscribes the whole component to the context. Any change (even a typed character elsewhere) re-renders it and all its children, which delays the response to the next tap.',
  frameworkRule: 'React: context over-subscription',
  docs: [docs.context, docs.memo],
  steps: [
    'Split the context so this component only gets the values it needs',
    'Wrap the heavy child in memo()',
    'Compute derived lists with useMemo',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const inp = pageMetric(pages, 'inp') ?? 380
    // Custom hooks that read a context (`useCart`, `useAuth`…) subscribe their callers just like useContext does.
    const contextHooks = new Set(['useContext'])
    for (const file of scan.files)
      for (const fn of file.functions)
        if (
          /^use[A-Z]/.test(fn.name) &&
          fn.calls.some((c) => c.callee === 'useContext' || contextHooks.has(c.callee))
        )
          contextHooks.add(fn.name)
    for (const file of scan.files) {
      for (const c of file.components) {
        const ctx = c.hooks.find((h) => contextHooks.has(h.name))
        if (!ctx || c.memoized) continue
        // Only components that do real work on each render: they render a list, or are big.
        const body = snippet(file, c.line, c.endLine - c.line)
        const rendersList = /\.map\(/.test(body) && c.elements.length > 0
        const heavy = rendersList || c.elements.length >= 12
        if (!heavy) continue
        out.push({
          location: loc(file, ctx.line, c.name),
          chain: {
            metric: 'inp',
            value: inp,
            element: 'input → list below it',
            component: { name: c.name, location: loc(file, c.line), renders: 40 },
            code: { snippet: lineText(file, ctx.line), location: loc(file, ctx.line) },
          },
          gain: { from: inp, to: Math.max(80, inp * 0.4), scoreDelta: 7 },
          changes: [
            {
              file: file.path,
              before: `export function ${c.name}(`,
              after: `export const ${c.name} = memo(function ${c.name}(`,
            },
            replaceLine(
              file,
              ctx.line,
              `${lineText(file, ctx.line).trim()} // select only the slice this component needs`,
            ),
          ],
          automatic: false,
          prevent: { metric: 'inp', max: 200 },
        })
      }
    }
    return out
  },
}

/** 7. useEffect that starts a timer / listener and never cleans up. */
export const effectWithoutCleanup: Rule = {
  id: 'react/effect-without-cleanup',
  pack: 'react',
  title: 'Effect starts a timer but never stops it',
  plain: 'A background task keeps running after you leave the page',
  severity: 'critical',
  metrics: ['memoryMb', 'inp'],
  areas: ['memory', 'javascript'],
  why: 'setInterval / addEventListener / subscriptions created in useEffect keep running after the component unmounts unless the effect returns a cleanup. Each visit adds another one, so the app gets slower and heavier over time.',
  frameworkRule: 'React: effect without cleanup',
  docs: [docs.effect],
  steps: [
    'Return a cleanup function from the effect',
    'Clear the interval / remove the listener / close the socket in it',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const memory = pageMetric(pages, 'memoryMb') ?? 120
    for (const file of scan.files) {
      for (const c of file.components) {
        for (const h of c.hooks.filter(
          (h) => h.name === 'useEffect' || h.name === 'useLayoutEffect',
        )) {
          if (h.hasCleanup) continue
          const leak = h.calls.find((call) =>
            /^(setInterval|setTimeout|addEventListener|\w+\.addEventListener|\w+\.subscribe|\w+\.on|new WebSocket|new EventSource|new ResizeObserver|new IntersectionObserver|new MutationObserver)$/.test(
              call,
            ),
          )
          if (!leak) continue
          out.push({
            location: loc(file, h.line, c.name),
            title: `Effect starts ${leak.replace(/^new /, '')} without cleanup`,
            chain: {
              metric: 'memoryMb',
              value: memory,
              component: { name: c.name, location: loc(file, c.line) },
              code: { snippet: snippet(file, h.line), location: loc(file, h.line) },
            },
            gain: {
              from: memory,
              to: Math.max(30, memory * 0.5),
              scoreDelta: 5,
              note: 'memory and INP after long sessions',
            },
            changes: [
              {
                file: file.path,
                before: '  }, [])',
                after: '    return () => clearInterval(id)\n  }, [])',
              },
            ],
            automatic: false,
            prevent: { metric: 'memoryMb', max: 80 },
          })
        }
      }
    }
    return out
  },
}

/** 3. Namespace import of a tree-shakeable library pulls in the whole thing. */
export const namespaceImport: Rule = {
  id: 'react/namespace-import',
  pack: 'general',
  title: 'Whole library imported for a few functions',
  plain: 'A big code library is downloaded although only a small part is used',
  severity: 'warning',
  metrics: ['tbt', 'lcp', 'jsKb'],
  areas: ['bundle', 'javascript'],
  why: 'import * as lib (or the default import of moment/lodash) stops the bundler from dropping unused functions, so the whole package ends up in the bundle.',
  docs: [docs.bundle],
  steps: ['Import only the functions you use', 'Or switch to a lighter library'],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const jsKb = pageMetric(pages, 'jsKb') ?? 420
    for (const file of scan.files) {
      for (const imp of file.imports) {
        const heavy = HEAVY_NAMESPACE[imp.source]
        if (!heavy) continue
        const whole =
          imp.namespace ||
          (imp.defaultImport !== undefined && ['moment', 'lodash'].includes(imp.source))
        if (!whole) continue
        const line = lineText(file, imp.line)
        out.push({
          location: loc(file, imp.line),
          title: `Whole ${imp.source} imported`,
          plain: `The whole ${imp.source} library (${heavy.sizeKb} KB) is downloaded although only a few functions are used`,
          chain: {
            metric: 'jsKb',
            value: jsKb,
            dependency: { name: imp.source, sizeKb: heavy.sizeKb },
            code: { snippet: line, location: loc(file, imp.line) },
          },
          gain: { from: jsKb, to: Math.max(50, jsKb - heavy.sizeKb * 0.8), scoreDelta: 4 },
          changes: [replaceLine(file, imp.line, heavy.fix)],
          automatic: imp.source !== 'moment',
          prevent: { metric: 'jsKb', max: 250 },
        })
      }
    }
    return out
  },
}

/** 12. Heavy component imported eagerly but shown only on demand (chat widget). */
export const eagerConditionalImport: Rule = {
  id: 'react/eager-conditional-import',
  pack: 'react',
  title: 'On-demand component is in the main bundle',
  plain: 'Code for something most visitors never open is downloaded by everyone',
  severity: 'warning',
  metrics: ['tbt', 'jsKb'],
  areas: ['code-splitting', 'bundle'],
  why: 'The component is only rendered behind a condition (a button, a toggle) but is imported statically, so its code ships with the first load.',
  frameworkRule: 'React: lazy() for conditional components',
  docs: [docs.lazy],
  steps: [
    'Replace the static import with React.lazy(() => import(...)) or next/dynamic',
    'Wrap it in <Suspense> with a small fallback',
  ],
  detect: ({ scan, pages }) => {
    const out: Finding[] = []
    if (!scan) return out
    const jsKb = pageMetric(pages, 'jsKb') ?? 420
    const sizeOf = new Map(scan.files.map((f) => [f.path, f.sizeBytes]))
    for (const file of scan.files) {
      for (const c of file.components) {
        for (const child of c.conditionalChildren) {
          const imp = file.imports.find(
            (i) =>
              !i.dynamic && (i.defaultImport === child || i.named.includes(child)) && i.resolved,
          )
          if (!imp?.resolved) continue
          const target = imp.resolved
          const graph = scan.files.map((f) => ({
            path: f.path,
            imports: f.imports.map((i) => i.resolved).filter((r): r is string => Boolean(r)),
            packages: f.imports
              .filter((i) => !i.resolved && !i.source.startsWith('react'))
              .map((i) => i.source),
          }))
          const { bytes: subtree, packages: heavyLibs } = subtreeStats(target, graph, sizeOf)
          const heavyLib = heavyLibs.length > 0
          if (subtree < 12_000 && !heavyLib) continue
          const kb = Math.max(30, Math.round(subtree / 1024) + (heavyLib ? 60 : 0))
          const line = lineText(file, imp.line)
          out.push({
            location: loc(file, imp.line, c.name),
            title: `${child} loaded eagerly`,
            plain: `The ${child} code (~${kb} KB) is downloaded by every visitor although it only shows on demand`,
            chain: {
              metric: 'jsKb',
              value: jsKb,
              dependency: { name: child, sizeKb: kb },
              component: { name: c.name, location: loc(file, c.line) },
              code: { snippet: line, location: loc(file, imp.line) },
            },
            gain: { from: jsKb, to: Math.max(50, jsKb - kb), scoreDelta: 4 },
            changes: [
              replaceLine(file, imp.line, `const ${child} = lazy(() => import('${imp.source}'))`),
            ],
            automatic: false,
            prevent: { metric: 'jsKb', max: 250 },
          })
        }
      }
    }
    return out
  },
}

/** Bytes and third-party packages reachable from one file through local imports. */
function subtreeStats(
  start: string,
  graph: { path: string; imports: string[]; packages: string[] }[],
  sizeOf: Map<string, number>,
): { bytes: number; packages: string[] } {
  const seen = new Set<string>()
  const packages = new Set<string>()
  const stack = [start]
  let bytes = 0
  while (stack.length) {
    const p = stack.pop()
    if (!p || seen.has(p)) continue
    seen.add(p)
    bytes += sizeOf.get(p) ?? 0
    const node = graph.find((g) => g.path === p)
    for (const pkg of node?.packages ?? []) packages.add(pkg)
    stack.push(...(node?.imports ?? []))
  }
  return { bytes, packages: [...packages] }
}

export const reactRules: Rule[] = [
  contextRerender,
  effectWithoutCleanup,
  namespaceImport,
  eagerConditionalImport,
]
