import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useDisplay } from '../../../state/theme'

export interface DiagramProps {
  /** Progress through one loop, 0 → 1. */
  p: number
}

/** 0 before `from`, 1 after `to`, linear in between. */
export function seg(p: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (p - from) / (to - from)))
}

/** Smooth start and stop for movement. */
export function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2
}

interface FrameProps {
  /** Length of one loop in milliseconds. */
  duration: number
  /** Progress shown when motion is off: the moment that explains the idea best. */
  still: number
  label: string
  caption?: ReactNode
  small?: boolean
  render: (p: number) => ReactNode
}

/**
 * Plays a diagram in a loop. It pauses while hovered or focused, stops while
 * scrolled out of view, and shows one still frame when reduced motion is on.
 */
export function DiagramFrame({ duration, still, label, caption, small, render }: FrameProps) {
  const reducedMotion = useDisplay((s) => s.reducedMotion)
  const ref = useRef<HTMLElement>(null)
  const [held, setHeld] = useState(false)
  const [visible, setVisible] = useState(false)
  const [p, setP] = useState(still)
  const elapsed = useRef(still * duration)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(Boolean(entry?.isIntersecting)),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const running = visible && !held && !reducedMotion
  useEffect(() => {
    if (!running) return
    let frame = 0
    let last = performance.now()
    let drawn = 0
    // Thumbnails redraw at about 20 frames a second; the big diagram at full speed.
    const every = small ? 50 : 0
    const tick = (now: number) => {
      elapsed.current = (elapsed.current + now - last) % duration
      last = now
      if (now - drawn >= every) {
        drawn = now
        setP(elapsed.current / duration)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, duration, small])

  const shown = reducedMotion ? still : p
  return (
    <figure
      ref={ref}
      className={`diagram ${small ? 'diagram-small' : ''}`}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      tabIndex={small ? -1 : 0}
    >
      <svg viewBox="0 0 360 220" role="img" aria-label={label}>
        <defs>
          <marker
            id="d-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" className="d-arrow-head" />
          </marker>
          <pattern
            id="d-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className="d-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="d-hatch-line" />
          </pattern>
        </defs>
        {render(shown)}
      </svg>
      {!small ? (
        <figcaption>
          {caption}
          <span className="diagram-hint muted">
            {reducedMotion ? 'Animation off (reduced motion)' : held ? 'Paused' : 'Hover to pause'}
          </span>
        </figcaption>
      ) : null}
    </figure>
  )
}

/** A phone outline with a screen area starting at (x + 8, y + 18). */
export function Phone({
  x,
  y,
  w = 120,
  h = 200,
}: {
  x: number
  y: number
  w?: number
  h?: number
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} className="d-device" />
      <rect x={x + 8} y={y + 18} width={w - 16} height={h - 30} rx={4} className="d-screen" />
      <rect x={x + w / 2 - 14} y={y + 7} width={28} height={4} rx={2} className="d-line" />
    </g>
  )
}

/** A big running clock, e.g. "1.8 s". */
export function Timer({
  x,
  y,
  ms,
  label,
  tone = 'text',
}: {
  x: number
  y: number
  ms: number
  label: string
  tone?: 'text' | 'good' | 'warning' | 'critical'
}) {
  const text = ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
  return (
    <g>
      <text x={x} y={y} className="d-label">
        {label}
      </text>
      <text x={x} y={y + 30} className={`d-timer d-${tone}`}>
        {text}
      </text>
    </g>
  )
}

/** A pointing finger (a filled circle with a ring) used for taps. */
export function Finger({ x, y, pressed }: { x: number; y: number; pressed: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={pressed ? 9 : 11} className="d-finger" />
      {pressed ? <circle r={18} className="d-ripple" /> : null}
    </g>
  )
}

/** A labelled point on a timeline at y = 170. */
export function Mark({
  x,
  label,
  on,
  strong,
}: {
  x: number
  label: string
  on: boolean
  strong?: boolean
}) {
  return (
    <g opacity={on ? 1 : 0.25}>
      <circle cx={x} cy={170} r={strong ? 5 : 3.5} className={strong ? 'd-dot-good' : 'd-dot'} />
      <text x={x} y={198} textAnchor="middle" className="d-small">
        {label}
      </text>
    </g>
  )
}
