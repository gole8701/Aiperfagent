import { describe, expect, it } from 'vitest'

import { generateTree } from '../../test/generate-tree'
import { allBranchIds, idsOnPathTo, visibleGraph } from './visible'

describe('visibleGraph', () => {
  it('mounts only expanded branches', () => {
    const tree = generateTree(100)
    const collapsed = visibleGraph(tree, { expanded: new Set(), problemsOnly: false, query: '' })
    expect(collapsed.nodes).toHaveLength(1)
    const src = tree.children[0]
    const opened = visibleGraph(tree, { expanded: new Set([tree.id, src?.id ?? '']), problemsOnly: false, query: '' })
    expect(opened.nodes.length).toBe(2 + (src?.children.length ?? 0))
    expect(opened.edges.length).toBe(opened.nodes.length - 1)
  })

  it('problems only keeps branches with issues', () => {
    const tree = generateTree(100)
    const graph = visibleGraph(tree, { expanded: allBranchIds(tree), problemsOnly: true, query: '' })
    expect(graph.nodes.every((n) => n.depth === 0 || n.node.counts.critical + n.node.counts.warning > 0)).toBe(true)
  })

  it('search opens the path to matches', () => {
    const tree = generateTree(200)
    const graph = visibleGraph(tree, { expanded: new Set(), problemsOnly: false, query: 'File3.tsx' })
    const hits = graph.nodes.filter((n) => n.match)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((n) => n.node.name.includes('File3'))).toBe(true)
  })

  it('stays fast with 10,000 nodes fully expanded', () => {
    const tree = generateTree(10_000, 50)
    const expanded = allBranchIds(tree)
    const start = performance.now()
    const graph = visibleGraph(tree, { expanded, problemsOnly: false, query: '' })
    const elapsed = performance.now() - start
    expect(graph.nodes.length).toBeGreaterThan(10_000)
    expect(elapsed).toBeLessThan(100)
  })

  it('finds the ids on the way to a file path', () => {
    const tree = generateTree(50)
    const trail = idsOnPathTo(tree, 'src/dir1/File2.tsx')
    expect(trail).toHaveLength(4)
    expect(trail[0]).toBe(tree.id)
  })
})
