import type { Severity, TreeNode } from '@perfagent/core'
import { worstSeverity } from '@perfagent/core'

/**
 * Pure "what is on screen" computation for the flow diagram. Only expanded
 * branches produce nodes, so a 10,000-file project mounts a few hundred
 * React Flow nodes at a time.
 */
export interface VisibleNode {
  node: TreeNode
  depth: number
  parentId?: string
  expanded: boolean
  hasChildren: boolean
  /** True when the search matched this node itself (not just an ancestor). */
  match: boolean
}

export interface VisibleEdge {
  id: string
  source: string
  target: string
  severity?: Severity
}

export interface VisibleGraph {
  nodes: VisibleNode[]
  edges: VisibleEdge[]
}

export interface ViewState {
  expanded: Set<string>
  problemsOnly: boolean
  query: string
}

export function visibleGraph(root: TreeNode, view: ViewState): VisibleGraph {
  const query = view.query.trim().toLowerCase()
  const matches = query ? matchingIds(root, query) : undefined
  const nodes: VisibleNode[] = []
  const edges: VisibleEdge[] = []
  const walk = (node: TreeNode, depth: number, parentId?: string): void => {
    const children = node.children.filter((child) => keep(child, view.problemsOnly, matches))
    const expanded = view.expanded.has(node.id) || matches?.ancestors.has(node.id) === true
    nodes.push({ node, depth, parentId, expanded, hasChildren: children.length > 0, match: matches?.hits.has(node.id) ?? false })
    if (!expanded) return
    for (const child of children) {
      edges.push({ id: `${node.id}->${child.id}`, source: node.id, target: child.id, severity: worstSeverity(child) })
      walk(child, depth + 1, node.id)
    }
  }
  walk(root, 0)
  return { nodes, edges }
}

function keep(node: TreeNode, problemsOnly: boolean, matches: Matches | undefined): boolean {
  if (problemsOnly && !worstSeverity(node)) return false
  if (matches && !matches.hits.has(node.id) && !matches.ancestors.has(node.id)) return false
  return true
}

interface Matches {
  hits: Set<string>
  ancestors: Set<string>
}

/** Ids whose name or path contains the query, plus every ancestor so the path to them opens. */
export function matchingIds(root: TreeNode, query: string): Matches {
  const hits = new Set<string>()
  const ancestors = new Set<string>()
  const walk = (node: TreeNode, trail: string[]): boolean => {
    let any = false
    for (const child of node.children) if (walk(child, [...trail, node.id])) any = true
    if (node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)) {
      hits.add(node.id)
      any = true
    }
    if (any) for (const id of trail) ancestors.add(id)
    return any
  }
  walk(root, [])
  return { hits, ancestors }
}

export function allBranchIds(root: TreeNode): Set<string> {
  const ids = new Set<string>()
  const walk = (node: TreeNode): void => {
    if (node.children.length) ids.add(node.id)
    for (const child of node.children) walk(child)
  }
  walk(root)
  return ids
}

/** Ids on the path from the root to the node at `path` (a file path or node id), for deep links like /flow/src/App.tsx. */
export function idsOnPathTo(root: TreeNode, target: string): string[] {
  const trail: string[] = []
  const walk = (node: TreeNode): boolean => {
    trail.push(node.id)
    if (node.id === target || (node.path === target && node.path !== '')) return true
    for (const child of node.children) if (walk(child)) return true
    trail.pop()
    return false
  }
  walk(root)
  return trail
}

/** Problems in a node and everything inside it. */
export function issueIdsWithin(node: TreeNode): string[] {
  const ids = [...node.issueIds]
  for (const child of node.children) ids.push(...issueIdsWithin(child))
  return ids
}
