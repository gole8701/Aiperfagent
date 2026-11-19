import type { Issue, Severity, TreeNode } from './types.js'

/** Attach issues to their deepest node and count them up to every parent. */
export function attachIssues(root: TreeNode, issues: Issue[]): TreeNode {
  const byFile = new Map<string, Issue[]>()
  for (const issue of issues) {
    if (!issue.location) continue
    const list = byFile.get(issue.location.file) ?? []
    list.push(issue)
    byFile.set(issue.location.file, list)
  }
  const visit = (node: TreeNode): TreeNode['counts'] => {
    node.issueIds = []
    const counts = { critical: 0, warning: 0, info: 0 }
    if (node.kind === 'file') {
      const here = byFile.get(node.path) ?? []
      for (const issue of here) {
        const owner = deepestOwner(node, issue.location?.line ?? 0) ?? node
        owner.issueIds.push(issue.id)
      }
    }
    for (const child of node.children) {
      const c = visit(child)
      counts.critical += c.critical
      counts.warning += c.warning
      counts.info += c.info
    }
    for (const id of node.issueIds) {
      const sev = issues.find((i) => i.id === id)?.severity
      if (sev) counts[sev]++
    }
    node.counts = counts
    return counts
  }
  visit(root)
  return root
}

function deepestOwner(file: TreeNode, line: number): TreeNode | undefined {
  let best: TreeNode | undefined
  const walk = (node: TreeNode): void => {
    for (const child of node.children) {
      if (child.line !== undefined && child.line <= line && (!best || (child.line >= (best.line ?? 0)))) {
        best = child
      }
      walk(child)
    }
  }
  walk(file)
  return best
}

export function worstSeverity(node: TreeNode): Severity | undefined {
  if (node.counts.critical) return 'critical'
  if (node.counts.warning) return 'warning'
  if (node.counts.info) return 'info'
  return undefined
}

export function findNode(root: TreeNode, id: string): TreeNode | undefined {
  if (root.id === id) return root
  for (const child of root.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return undefined
}

export function pathTo(root: TreeNode, id: string): TreeNode[] {
  const trail: TreeNode[] = []
  const walk = (node: TreeNode): boolean => {
    trail.push(node)
    if (node.id === id) return true
    for (const child of node.children) if (walk(child)) return true
    trail.pop()
    return false
  }
  walk(root)
  return trail
}

export function countNodes(root: TreeNode): number {
  let n = 1
  for (const child of root.children) n += countNodes(child)
  return n
}
