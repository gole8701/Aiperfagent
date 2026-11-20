import ELK, { type ElkNode } from 'elkjs/lib/elk-api.js'
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker'

import type { VisibleGraph } from './visible'

export const NODE_WIDTH = 190
export const NODE_HEIGHT = 44

export type Positions = Map<string, { x: number; y: number }>

const elk = new ELK({ workerFactory: () => new ElkWorker() })

/** Big expansions skip ELK: a tidy tree is instant and good enough when thousands of nodes are open. */
const ELK_LIMIT = 1500

/** Left-to-right layered layout off the main thread; falls back to a tidy tree for very large graphs. */
export async function layoutGraph(graph: VisibleGraph): Promise<Positions> {
  if (graph.nodes.length > ELK_LIMIT) return tidyTree(graph)
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.spacing.nodeNode': '14',
      'elk.edgeRouting': 'SPLINES',
    },
    children: graph.nodes.map((n) => ({ id: n.node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: graph.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  }
  const result = await elk.layout(elkGraph)
  const positions: Positions = new Map()
  for (const child of result.children ?? [])
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  return positions
}

export function tidyTree(graph: VisibleGraph): Positions {
  const positions: Positions = new Map()
  const childrenOf = new Map<string, string[]>()
  for (const e of graph.edges)
    childrenOf.set(e.source, [...(childrenOf.get(e.source) ?? []), e.target])
  const rowHeight = NODE_HEIGHT + 12
  const columnWidth = NODE_WIDTH + 60
  let cursor = 0
  const place = (id: string, depth: number): number => {
    const kids = childrenOf.get(id) ?? []
    let y: number
    if (kids.length === 0) {
      y = cursor
      cursor += rowHeight
    } else {
      const ys = kids.map((k) => place(k, depth + 1))
      y = ((ys[0] ?? 0) + (ys[ys.length - 1] ?? 0)) / 2
    }
    positions.set(id, { x: depth * columnWidth, y })
    return y
  }
  const root = graph.nodes.find((n) => n.depth === 0)
  if (root) place(root.node.id, 0)
  return positions
}
