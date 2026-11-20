import type { Issue, PageResult, Severity, TreeNode } from '@perfagent/core'

/**
 * Pure layout for the project globe. Folders sit on the sphere; files orbit
 * their folder on a small circle. For URL-only scans the same shapes hold
 * domains (as folders) and requests (as files).
 */
export interface GlobePoint {
  id: string
  kind: 'folder' | 'file'
  label: string
  path: string
  /** Index into `points` of the owning folder; folders own themselves. */
  folder: number
  position: [number, number, number]
  /** Orbit around the folder: unit vectors `u`, `v`, radius and start angle. Folders do not orbit. */
  orbit?: { u: [number, number, number]; v: [number, number, number]; radius: number; angle: number }
  severity?: Severity
  issueIds: string[]
  /** Direct children count (folders only), shown on the info card as "4 files · 2 issues". */
  fileCount: number
}

export interface GlobeLayout {
  points: GlobePoint[]
  radius: number
}

type Vec = [number, number, number]

export const GLOBE_RADIUS = 1

export function layoutGlobe(input: { tree?: TreeNode; page?: PageResult; issues: Issue[] }): GlobeLayout {
  const groups = input.tree ? groupsFromTree(input.tree, input.issues) : groupsFromPage(input.page, input.issues)
  const points: GlobePoint[] = []
  const directions = fibonacciSphere(groups.length)
  groups.forEach((group, index) => {
    const d = directions[index] ?? [0, 1, 0]
    const folderIndex = points.length
    points.push({
      id: group.id,
      kind: 'folder',
      label: group.label,
      path: group.path,
      folder: folderIndex,
      position: scale(d, GLOBE_RADIUS),
      severity: group.severity,
      issueIds: group.issueIds,
      fileCount: group.files.length,
    })
    const [u, v] = tangentBasis(d)
    const orbitRadius = Math.min(0.32, 0.06 + 0.012 * group.files.length) * GLOBE_RADIUS
    group.files.forEach((file, j) => {
      const angle = (j / group.files.length) * Math.PI * 2
      points.push({
        id: file.id,
        kind: 'file',
        label: file.label,
        path: file.path,
        folder: folderIndex,
        position: orbitPosition(d, u, v, orbitRadius, angle),
        orbit: { u, v, radius: orbitRadius, angle },
        severity: file.severity,
        issueIds: file.issueIds,
        fileCount: 0,
      })
    })
  })
  return { points, radius: GLOBE_RADIUS }
}

/** Position on the sphere surface for a file at `angle` on its folder's orbit. Used per frame by the scene. */
export function orbitPosition(center: Vec, u: Vec, v: Vec, radius: number, angle: number): Vec {
  const c = Math.cos(angle) * radius
  const s = Math.sin(angle) * radius
  const raw: Vec = [center[0] + u[0] * c + v[0] * s, center[1] + u[1] * c + v[1] * s, center[2] + u[2] * c + v[2] * s]
  return scale(normalise(raw), GLOBE_RADIUS * 1.02)
}

interface Group {
  id: string
  label: string
  path: string
  severity?: Severity
  issueIds: string[]
  files: { id: string; label: string; path: string; severity?: Severity; issueIds: string[] }[]
}

function groupsFromTree(root: TreeNode, issues: Issue[]): Group[] {
  const severityOf = new Map(issues.map((i) => [i.id, i.severity]))
  const groups: Group[] = []
  const visit = (node: TreeNode): void => {
    const files = node.children.filter((c) => c.kind === 'file')
    const dirs = node.children.filter((c) => c.kind === 'dir' || c.kind === 'root')
    if (files.length || node.kind === 'root') {
      groups.push({
        id: node.id,
        label: node.kind === 'root' ? node.name : `${node.name}/`,
        path: node.path,
        severity: worst(node.counts),
        issueIds: collectIssueIds(node),
        files: files.map((f) => {
          const ids = collectIssueIds(f)
          return { id: f.id, label: f.name, path: f.path, severity: worstOf(ids.map((id) => severityOf.get(id))), issueIds: ids }
        }),
      })
    }
    for (const dir of dirs) visit(dir)
  }
  visit(root)
  return groups
}

function groupsFromPage(page: PageResult | undefined, issues: Issue[]): Group[] {
  if (!page) return []
  const byHost = new Map<string, Group>()
  const pageHost = hostOf(page.url)
  page.requests.forEach((request, index) => {
    const host = hostOf(request.url) || 'other'
    let group = byHost.get(host)
    if (!group) {
      group = { id: `host:${host}`, label: host === pageHost ? `${host} (your site)` : host, path: host, issueIds: [], files: [] }
      byHost.set(host, group)
    }
    const related = issues.filter((i) => i.chain.some((step) => step.kind === 'request' && request.url.endsWith(step.label))).map((i) => i.id)
    const severity = worstOf(related.map((id) => issues.find((i) => i.id === id)?.severity))
    group.files.push({ id: `req:${index}`, label: fileName(request.url), path: request.url, severity, issueIds: related })
    group.issueIds.push(...related)
  })
  for (const group of byHost.values()) group.severity = worstOf(group.files.map((f) => f.severity))
  return [...byHost.values()]
}

function collectIssueIds(node: TreeNode): string[] {
  const ids = [...node.issueIds]
  for (const child of node.children) ids.push(...collectIssueIds(child))
  return ids
}

function worst(counts: TreeNode['counts']): Severity | undefined {
  if (counts.critical) return 'critical'
  if (counts.warning) return 'warning'
  return counts.info ? 'info' : undefined
}

function worstOf(list: (Severity | undefined)[]): Severity | undefined {
  const rank = { critical: 3, warning: 2, info: 1 }
  let best: Severity | undefined
  for (const s of list) if (s && (!best || rank[s] > rank[best])) best = s
  return best
}

function fibonacciSphere(count: number): Vec[] {
  const out: Vec[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    out.push([Math.cos(theta) * r, y, Math.sin(theta) * r])
  }
  return out
}

function tangentBasis(d: Vec): [Vec, Vec] {
  const helper: Vec = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = normalise(cross(helper, d))
  const v = normalise(cross(d, u))
  return [u, v]
}

function cross(a: Vec, b: Vec): Vec {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalise(v: Vec): Vec {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function scale(v: Vec, k: number): Vec {
  return [v[0] * k, v[1] * k, v[2] * k]
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function fileName(url: string): string {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? url
  } catch {
    return url
  }
}
