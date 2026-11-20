import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '../../components/Button'
import { token, useDisplay } from '../../state/theme'

import type { GlobeLayout, GlobePoint } from './layout'
import { GlobeScene } from './scene'

interface GlobeProps {
  layout: GlobeLayout
  selectedId?: string
  /** Point ids that match the active chip; empty when no chip is active. */
  highlighted: Set<string>
  filtering: boolean
  onSelect: (point: GlobePoint | undefined) => void
  scoreLabel: string
  infoCard?: { title: string; metric: string; where: string }
}

function colours(): ConstructorParameters<typeof GlobeScene>[0]['colors'] {
  return {
    folder: token('--accent'),
    file: token('--muted'),
    critical: token('--critical'),
    warning: token('--warning'),
    info: token('--info'),
    dim: token('--border-strong'),
    accent: token('--accent'),
    star: token('--muted'),
  }
}

export default function Globe({
  layout,
  selectedId,
  highlighted,
  filtering,
  onSelect,
  scoreLabel,
  infoCard,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coreRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GlobeScene>(null)
  const { theme, reducedMotion } = useDisplay()
  const [paused, setPaused] = useState(false)
  const [hover, setHover] = useState<{ point: GlobePoint; x: number; y: number }>()
  const [webgl, setWebgl] = useState(true)
  const byId = useMemo(() => new Map(layout.points.map((p) => [p.id, p])), [layout])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let scene: GlobeScene
    try {
      scene = new GlobeScene({
        canvas,
        layout,
        colors: colours(),
        reducedMotion,
        onSelect: (id) => onSelect(id ? byId.get(id) : undefined),
        onHover: (id, x, y) => {
          const point = id ? byId.get(id) : undefined
          setHover(point ? { point, x, y } : undefined)
        },
      })
    } catch {
      setWebgl(false)
      return
    }
    sceneRef.current = scene
    const observer = new ResizeObserver(() => scene.resize())
    observer.observe(canvas)
    let frame = 0
    const place = (): void => {
      frame = requestAnimationFrame(place)
      const core = scene.project('core')
      if (core && coreRef.current)
        coreRef.current.style.transform = `translate(${core.x}px, ${core.y}px)`
      if (cardRef.current && selectedId) {
        const p = scene.project(selectedId)
        if (p) {
          cardRef.current.style.transform = `translate(${p.x + 14}px, ${p.y - 10}px)`
          cardRef.current.style.opacity = p.visible ? '1' : '0.35'
        }
      }
    }
    place()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
    // The scene is rebuilt only when the layout changes; selection and colours are pushed below.
  }, [layout, reducedMotion])

  useEffect(() => {
    sceneRef.current?.setColors(colours())
    sceneRef.current?.restyle(highlighted, selectedId, filtering)
  }, [theme, highlighted, selectedId, filtering, layout])

  useEffect(() => {
    if (selectedId) sceneRef.current?.flyTo(selectedId)
  }, [selectedId])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.paused = paused
  }, [paused])

  function onKey(event: React.KeyboardEvent): void {
    const scene = sceneRef.current
    if (!scene) return
    const step = 0.15
    const actions: Record<string, () => void> = {
      ArrowLeft: () => scene.rotate(-step, 0),
      ArrowRight: () => scene.rotate(step, 0),
      ArrowUp: () => scene.rotate(0, -step),
      ArrowDown: () => scene.rotate(0, step),
      Enter: () => {
        const id = scene.cycleProblem(event.shiftKey ? -1 : 1)
        onSelect(id ? byId.get(id) : undefined)
      },
      ' ': () => setPaused((p) => !p),
      Home: () => scene.reset(),
      Escape: () => onSelect(undefined),
      '+': () => scene.zoom(-0.3),
      '-': () => scene.zoom(0.3),
    }
    const action = actions[event.key]
    if (action) {
      event.preventDefault()
      action()
    }
  }

  return (
    <div className="globe" data-tour="globe">
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        tabIndex={0}
        role="application"
        aria-label={`Project globe with ${layout.points.length} points. Arrow keys rotate, Enter cycles through problems, Space pauses, Home resets, Escape clears the selection.`}
        onKeyDown={onKey}
      />
      {!webgl ? (
        <div className="globe-fallback">
          3D is not available in this browser. The problems list below has everything the globe
          shows.
        </div>
      ) : null}
      <div ref={coreRef} className="globe-core-label" aria-hidden="true">
        <strong>PerfAgent</strong>
        <span>{scoreLabel}</span>
      </div>
      {hover && hover.point.id !== selectedId ? (
        <div className="globe-tooltip" style={{ left: hover.x, top: hover.y }} role="tooltip">
          <strong>{hover.point.label}</strong>
          {hover.point.kind === 'folder' ? ` · ${hover.point.fileCount} files` : ''}
          {hover.point.issueIds.length
            ? ` · ${hover.point.issueIds.length} issue${hover.point.issueIds.length > 1 ? 's' : ''}`
            : ' · healthy'}
        </div>
      ) : null}
      {selectedId && infoCard ? (
        <div ref={cardRef} className="globe-info" role="note">
          <strong>{infoCard.title}</strong>
          <div>{infoCard.metric}</div>
          <div className="mono">{infoCard.where}</div>
          <div className="muted">Full root cause and fix in the panel</div>
        </div>
      ) : null}
      <div className="globe-controls no-print" role="group" aria-label="Globe controls">
        <Button small onClick={() => sceneRef.current?.rotate(-0.4, 0)} aria-label="Rotate left">
          ←
        </Button>
        <Button small onClick={() => sceneRef.current?.rotate(0.4, 0)} aria-label="Rotate right">
          →
        </Button>
        <Button small onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button small onClick={() => sceneRef.current?.zoom(-0.4)} aria-label="Zoom in">
          +
        </Button>
        <Button small onClick={() => sceneRef.current?.zoom(0.4)} aria-label="Zoom out">
          −
        </Button>
        <Button small onClick={() => sceneRef.current?.reset()}>
          Reset view
        </Button>
      </div>
      <ul className="globe-legend" aria-label="Legend">
        <li>
          <span className="dot dot-critical" /> Critical (pulsing)
        </li>
        <li>
          <span className="dot dot-warning" /> Warning
        </li>
        <li>
          <span className="dot" style={{ background: 'var(--accent)' }} /> Folder
        </li>
        <li>
          <span className="dot" style={{ background: 'var(--muted)' }} /> Healthy file
        </li>
      </ul>
    </div>
  )
}
