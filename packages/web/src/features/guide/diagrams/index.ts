import type { ComponentType } from 'react'

import { AgentDiagram } from './AgentDiagram'
import { AiDiagram } from './AiDiagram'
import { BundleDiagram } from './BundleDiagram'
import { ClsDiagram } from './ClsDiagram'
import { FcpDiagram } from './FcpDiagram'
import type { DiagramProps } from './Frame'
import { InpDiagram } from './InpDiagram'
import { LcpDiagram } from './LcpDiagram'
import { MemoryDiagram } from './MemoryDiagram'
import { ScoreDiagram } from './ScoreDiagram'
import { SocketDiagram } from './SocketDiagram'
import { TbtDiagram } from './TbtDiagram'
import { TtfbDiagram } from './TtfbDiagram'

export { DiagramFrame } from './Frame'

export interface Diagram {
  Component: ComponentType<DiagramProps>
  /** Loop length in ms. */
  duration: number
  /** The frame shown when motion is off. */
  still: number
  /** What the animation shows, for screen readers and as the caption. */
  label: string
}

const lcp: Diagram = {
  Component: LcpDiagram,
  duration: 7000,
  still: 0.7,
  label:
    'A page loads on a phone. Small parts appear first, then the big picture paints and the clock stops: that moment is LCP.',
}
const ai: Diagram = {
  Component: AiDiagram,
  duration: 8000,
  still: 0.6,
  label:
    'A question goes to the AI model. The user waits for the first word, then the answer streams in while the cost grows.',
}

export const DIAGRAMS: Partial<Record<string, Diagram>> = {
  lcp,
  inp: {
    Component: InpDiagram,
    duration: 6000,
    still: 0.75,
    label:
      'A finger taps “Add to cart”. The main thread is busy, so the button only changes 360 ms later: that delay is INP.',
  },
  cls: {
    Component: ClsDiagram,
    duration: 6500,
    still: 0.7,
    label:
      'Left: a picture without a size loads and pushes the button down just as you tap, so you miss. Right: the space was reserved, so nothing moves.',
  },
  ttfb: {
    Component: TtfbDiagram,
    duration: 5500,
    still: 0.85,
    label:
      'The browser asks the server for the page, the server builds it, and the first byte travels back. The time until it arrives is TTFB.',
  },
  tbt: {
    Component: TbtDiagram,
    duration: 7000,
    still: 0.85,
    label:
      'Tasks on the main thread. Every part of a task over 50 ms is shaded red as blocking; the red parts add up to TBT.',
  },
  fcp: {
    Component: FcpDiagram,
    duration: 5500,
    still: 0.7,
    label:
      'A blank phone screen with a spinner, until the first text and logo appear: that moment is FCP.',
  },
  score: {
    Component: ScoreDiagram,
    duration: 7000,
    still: 0.85,
    label:
      'Each metric is turned into a 0–100 score and weighted; the gauge needle adds the weighted parts into one performance score.',
  },
  bundle: {
    Component: BundleDiagram,
    duration: 7000,
    still: 0.88,
    label:
      'Pieces of JavaScript stack up into one pile; then a phone has to download all of it before the page can work.',
  },
  memory: {
    Component: MemoryDiagram,
    duration: 7500,
    still: 0.88,
    label:
      'Memory over time. A healthy page goes back down after each clean-up; a leak keeps climbing past the poor line.',
  },
  live: {
    Component: SocketDiagram,
    duration: 8000,
    still: 0.9,
    label:
      'Messages flow until the connection drops. Top: the app reconnects again and again and floods the server. Bottom: it waits longer each time and reconnects calmly.',
  },
  'ai-first-token': ai,
  'ai-cost': ai,
  'measure-ai': ai,
  'agent-readiness': {
    Component: AgentDiagram,
    duration: 7000,
    still: 0.9,
    label:
      'An AI agent works through steps on your page: read it, find the button by its label, call a tool, check the result.',
  },
}
