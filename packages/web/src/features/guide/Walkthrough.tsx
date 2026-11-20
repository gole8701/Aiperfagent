import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { Button } from '../../components/Button'
import { useDisplay } from '../../state/theme'

import type { WalkthroughStep } from './markdown'
import { SCENES, SceneView, tourSelector } from './scenes'

interface WalkthroughProps {
  title: string
  steps: WalkthroughStep[]
  step: number
  onStep: (index: number) => void
  nextTopic?: { topic: string; title: string }
}

const STEP_MS = 4200

/** Animated walkthrough: a pointer moves over a mini version of the real screen; Play/Pause, dots, Replay and "Next guide". */
export function Walkthrough({ title, steps, step, onStep, nextTopic }: WalkthroughProps) {
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useDisplay((s) => s.reducedMotion)
  const location = useLocation()
  const timer = useRef<number>(undefined)
  const current = steps[step]

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!playing) return
    timer.current = window.setTimeout(() => {
      if (step + 1 < steps.length) onStep(step + 1)
      else setPlaying(false)
    }, STEP_MS)
    return () => window.clearTimeout(timer.current)
  }, [playing, step, steps.length, onStep])

  if (!current) return null
  const scene = SCENES[current.screen]
  const area = scene.areas[current.area]
  const onRealScreen = scene.route?.test(location.pathname)

  return (
    <section className="card walkthrough" aria-label={`Animated walkthrough: ${title}`}>
      <div className="card-title">
        <h3 className="label">
          Animated walkthrough · {title} · step {step + 1} of {steps.length}
        </h3>
        <span className="muted" style={{ fontSize: 12 }}>
          Screen: {scene.name}
        </span>
      </div>
      <div className="stage">
        <SceneView screen={current.screen} highlight={current.area} />
        {area ? <div className={`pointer ${reducedMotion ? 'no-motion' : ''}`} style={{ left: `${area.l + area.w / 2}%`, top: `${area.t + area.h / 2}%` }} aria-hidden="true" /> : null}
        <div className="caption" aria-live="polite">
          <strong>
            {step + 1}. {current.title}
          </strong>
          <div>{current.text}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <div className="row">
          <Button small onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Previous step">
            ‹
          </Button>
          <Button small variant="primary" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button small onClick={() => onStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1} aria-label="Next step">
            ›
          </Button>
          <Button
            small
            onClick={() => {
              onStep(0)
              setPlaying(true)
            }}
          >
            Replay
          </Button>
          <div className="dots" role="tablist" aria-label="Steps">
            {steps.map((s, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === step} aria-label={`Step ${i + 1}: ${s.title}`} className={`dot-btn ${i === step ? 'active' : ''}`} onClick={() => onStep(i)} />
            ))}
          </div>
        </div>
        <div className="row">
          {onRealScreen ? (
            <Button small onClick={() => void runTour(steps)}>
              Show me on the real screen
            </Button>
          ) : null}
          {nextTopic ? (
            <Link to={`/guide/${nextTopic.topic}`} style={{ fontSize: 13 }}>
              Next guide: {nextTopic.title} ›
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** The same steps over the real UI with driver.js; steps whose area has no element on this screen are skipped. */
async function runTour(steps: WalkthroughStep[]): Promise<void> {
  const { driver } = await import('driver.js')
  await import('driver.js/dist/driver.css')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const tourSteps = steps
    .map((s) => ({ selector: tourSelector(s.screen, s.area), s }))
    .filter((x) => x.selector && document.querySelector(x.selector))
    .map((x) => ({ element: x.selector, popover: { title: x.s.title, description: x.s.text } }))
  if (tourSteps.length === 0) return
  driver({ showProgress: true, animate: !reduced, steps: tourSteps, nextBtnText: 'Next ›', prevBtnText: '‹ Back', doneBtnText: 'Done' }).drive()
}
