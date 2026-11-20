import { useEffect, useState, type CSSProperties } from 'react'

import { Button } from '../../components/Button'
import { useDisplay } from '../../state/theme'

import type { CheckStep } from './content'
import { SHOTS } from './shots'

const STEP_MS = 5000

export function shotUrl(shot: string): string {
  return `${import.meta.env.BASE_URL}guide/${shot}.webp`
}

/**
 * "How to check it": real screenshots of the dashboard with a ring and a
 * pointer on the exact control. Advances on its own until the reader takes over.
 */
export function ShotTour({ steps, title }: { steps: CheckStep[]; title: string }) {
  const reducedMotion = useDisplay((s) => s.reducedMotion)
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(!reducedMotion)
  const [held, setHeld] = useState(false)
  const step = steps[index]

  useEffect(() => {
    if (!auto || held) return
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % steps.length), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [auto, held, index, steps.length])

  if (!step) return null
  const box = SHOTS[step.shot]?.[step.at]
  const go = (i: number) => {
    setAuto(false)
    setIndex((i + steps.length) % steps.length)
  }
  const shots = [...new Set(steps.map((s) => s.shot))]
  const focus = box
    ? ({ '--zx': `${box.x + box.w / 2}%`, '--zy': `${box.y + box.h / 2}%` } as CSSProperties)
    : undefined

  return (
    <section
      className="card shot-tour"
      aria-label={`How to check ${title} in PerfAgent`}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      <div className="shot-frame">
        <div className="shot-stage" style={focus}>
          {shots.map((shot) => (
            <img
              key={shot}
              src={shotUrl(shot)}
              alt=""
              loading="lazy"
              decoding="async"
              width={1440}
              height={900}
              className={shot === step.shot ? 'shown' : ''}
            />
          ))}
          {box ? (
            <>
              <div
                key={index}
                className="shot-ring"
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.w}%`,
                  height: `${box.h}%`,
                }}
              />
              <svg
                className="shot-cursor"
                viewBox="0 0 24 24"
                style={{
                  left: `${box.x + box.w / 2}%`,
                  top: `${box.y + box.h / 2}%`,
                }}
                aria-hidden="true"
              >
                <path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.8L4 20z" />
              </svg>
            </>
          ) : null}
        </div>
      </div>
      <div className="shot-caption" aria-live="polite">
        <span className="shot-number">{index + 1}</span>
        <p>{step.text}</p>
      </div>
      <div className="shot-controls">
        <Button small onClick={() => go(index - 1)} aria-label="Previous step">
          ‹ Prev
        </Button>
        <div className="shot-dots" role="group" aria-label="Steps">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              className={i === index ? 'active' : ''}
              aria-label={`Step ${i + 1}: ${s.text}`}
              aria-current={i === index || undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <Button small onClick={() => go(index + 1)} aria-label="Next step">
          Next ›
        </Button>
        <Button
          small
          variant="link"
          onClick={() => setAuto((a) => !a)}
          aria-pressed={auto}
          className="shot-play"
        >
          {auto ? 'Pause' : 'Play'}
        </Button>
      </div>
    </section>
  )
}
