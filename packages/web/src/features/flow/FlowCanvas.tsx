import { worstSeverity, type Severity, type TreeNode } from '@perfagent/core'
import { Background, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { memo, useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import { layoutGraph, NODE_HEIGHT, NODE_WIDTH, type Positions } from './elk-layout'
import type { VisibleGraph } from './visible'

interface FlowCanvasProps {
  graph: VisibleGraph
  selectedId?: string
  onSelect: (node: TreeNode) => void
  onToggle: (node: TreeNode) => void
}

type FlowNodeData = { node: TreeNode; expanded: boolean; hasChildren: boolean; match: boolean; selected: boolean; onToggle: (node: TreeNode) => void }
type FlowNode = Node<FlowNodeData, 'tree'>

const SEVERITY_VAR: Record<Severity, string> = { critical: 'var(--critical)', warning: 'var(--warning)', info: 'var(--info)' }

const TreeNodeView = memo(function TreeNodeView({ data }: NodeProps<FlowNode>) {
  const { node, expanded, hasChildren, match, selected } = data
  const severity = worstSeverity(node)
  const count = node.counts.critical + node.counts.warning + node.counts.info
  return (
    <div className={`flow-node ${selected ? 'selected' : ''} ${match ? 'match' : ''}`} style={{ borderColor: severity ? SEVERITY_VAR[severity] : undefined, width: NODE_WIDTH, height: NODE_HEIGHT }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {hasChildren ? (
        <button
          type="button"
          className="flow-chevron"
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation()
            data.onToggle(node)
          }}
        >
          {expanded ? '▾' : '▸'}
        </button>
      ) : (
        <span className="flow-chevron" aria-hidden="true" />
      )}
      <span className={`flow-tag tag-${node.kind}`}>{node.tag}</span>
      <span className="flow-name" title={node.path}>
        {node.name}
      </span>
      {count ? (
        <span className={`flow-badge badge-${severity ?? 'info'}`} aria-label={`${count} problems inside`}>
          {count}
        </span>
      ) : null}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
})

const nodeTypes = { tree: TreeNodeView }

export function FlowCanvas({ graph, selectedId, onSelect, onToggle }: FlowCanvasProps) {
  const [positions, setPositions] = useState<Positions>(new Map())

  useEffect(() => {
    let cancelled = false
    layoutGraph(graph).then((next) => {
      if (!cancelled) setPositions(next)
    })
    return () => {
      cancelled = true
    }
  }, [graph])

  const nodes = useMemo<FlowNode[]>(
    () =>
      graph.nodes.map((v) => ({
        id: v.node.id,
        type: 'tree',
        position: positions.get(v.node.id) ?? { x: v.depth * (NODE_WIDTH + 60), y: 0 },
        data: { node: v.node, expanded: v.expanded, hasChildren: v.hasChildren, match: v.match, selected: v.node.id === selectedId, onToggle },
        draggable: false,
        selectable: true,
      })),
    [graph, positions, selectedId, onToggle],
  )

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        style: { stroke: e.severity ? SEVERITY_VAR[e.severity] : 'var(--border-strong)', strokeWidth: e.severity ? 2 : 1 },
        animated: e.severity === 'critical',
      })),
    [graph],
  )

  return (
    <div className="flow-canvas" data-tour="tree">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => onSelect((node.data as FlowNodeData).node)}
        onlyRenderVisibleElements
        fitView
        minZoom={0.1}
        panOnScroll
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        aria-label="Project flow diagram"
      >
        <Background gap={24} color="var(--border)" />
        <MiniMap pannable zoomable nodeColor={(n) => (worstSeverity((n.data as FlowNodeData).node) === 'critical' ? '#ff6b4a' : worstSeverity((n.data as FlowNodeData).node) === 'warning' ? '#f5b83d' : '#4fa3ff')} />
      </ReactFlow>
    </div>
  )
}
