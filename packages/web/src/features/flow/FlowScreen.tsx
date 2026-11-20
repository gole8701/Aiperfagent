import { findNode, pathTo, type TreeNode } from '@perfagent/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Button } from '../../components/Button'
import { Empty, ErrorBox, Spinner } from '../../components/Card'
import { Toggle } from '../../components/Fields'
import { useReport } from '../../state/report'

import { FlowCanvas } from './FlowCanvas'
import { NodePanel } from './NodePanel'
import { allBranchIds, idsOnPathTo, visibleGraph } from './visible'
import './flow.css'

export default function FlowScreen() {
  const { report, status, loading, error } = useReport()
  const { '*': pathParam } = useParams()
  const navigate = useNavigate()
  const tree = report?.tree
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()

  // Deep link: /flow/src/App.tsx opens the path to that file and selects it.
  useEffect(() => {
    if (!tree) return
    const target = pathParam ? idsOnPathTo(tree, pathParam) : [tree.id]
    if (target.length === 0) return
    setExpanded(
      (prev) => new Set([...prev, ...target.slice(0, -1), ...(pathParam ? [] : [tree.id])]),
    )
    if (pathParam) setSelectedId(target[target.length - 1])
  }, [tree, pathParam])

  const graph = useMemo(
    () => (tree ? visibleGraph(tree, { expanded, problemsOnly, query }) : undefined),
    [tree, expanded, problemsOnly, query],
  )
  const selected = tree && selectedId ? findNode(tree, selectedId) : undefined
  const trail = tree && selectedId ? pathTo(tree, selectedId) : tree ? [tree] : []

  const toggle = useCallback((node: TreeNode) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      return next
    })
  }, [])

  const select = useCallback(
    (node: TreeNode) => {
      setSelectedId(node.id)
      if (node.children.length) setExpanded((prev) => new Set([...prev, node.id]))
      void navigate(node.kind === 'file' ? `/flow/${node.path}` : '/flow', { replace: true })
    },
    [navigate],
  )

  if (loading) {
    return (
      <div className="page">
        <Spinner label="Loading project tree" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="page">
        <ErrorBox error={error} />
      </div>
    )
  }
  if (!tree || !graph) {
    return (
      <div className="page">
        <Empty>
          <h2>No project tree in this report</h2>
          <p>
            Scan a local project to see its folders, files, components and functions here. URL-only
            scans have no source files.
          </p>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flow-screen">
      <div className="flow-main">
        <div className="flow-toolbar" data-tour="header">
          <input
            className="input"
            type="search"
            placeholder="Find a file or component"
            aria-label="Find a file or component"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button onClick={() => setExpanded(allBranchIds(tree))}>Expand all</Button>
          <Button onClick={() => setExpanded(new Set([tree.id]))}>Collapse all</Button>
          <Toggle label="Problems only" checked={problemsOnly} onChange={setProblemsOnly} />
          <span className="muted" style={{ fontSize: 12 }}>
            {graph.nodes.length} shown
          </span>
        </div>
        <nav className="breadcrumb" aria-label="Path" data-tour="crumbs">
          <span className="muted">Path:</span>
          {trail.map((node, index) => (
            <span key={node.id}>
              {index > 0 ? <span className="muted"> › </span> : null}
              <button
                type="button"
                onClick={() => select(node)}
                aria-current={index === trail.length - 1}
              >
                {node.name || 'root'}
              </button>
            </span>
          ))}
        </nav>
        <FlowCanvas graph={graph} selectedId={selectedId} onSelect={select} onToggle={toggle} />
        <div className="flow-legend" aria-label="Legend">
          <span>DIR folder</span>
          <span>TSX / TS file</span>
          <span>&lt;&gt; component</span>
          <span>fn function</span>
          <span>EL element</span>
          <span>Red / amber border and line = problem inside</span>
        </div>
      </div>
      <NodePanel node={selected} issues={report.issues} status={status} reportId={report.id} />
    </div>
  )
}
