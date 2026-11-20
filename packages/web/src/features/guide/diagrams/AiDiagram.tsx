import { Timer, seg, type DiagramProps } from './Frame'

const SENT = 0.12
const FIRST = 0.36
const DONE = 0.85
const FIRST_TOKEN_MS = 900
const WORDS = 'For a 10K run pick a light, cushioned shoe with a little room at the toes.'.split(
  ' ',
)
/** Example prices: prompt tokens are paid once, every answer token adds a little. */
const PROMPT_COST = 0.0012
const COST_PER_WORD = 0.00009

/** Prompt goes in, the user waits for the first word, then the answer streams and the bill grows. */
export function AiDiagram({ p }: DiagramProps) {
  const fade = 1 - seg(p, 0.93, 1)
  const shownWords = p < FIRST ? 0 : Math.ceil(seg(p, FIRST, DONE) * WORDS.length)
  const thinking = p >= SENT && p < FIRST
  const cost = p >= SENT ? PROMPT_COST + shownWords * COST_PER_WORD : 0
  const lines = wrap(WORDS.slice(0, shownWords), 30)
  return (
    <g opacity={fade}>
      <rect x={14} y={14} width={150} height={34} rx={10} className="d-bubble" />
      <text x={24} y={35} className="d-small">
        “Which shoe for a 10K run?”
      </text>
      <line x1={89} y1={50} x2={89} y2={70} className="d-axis" markerEnd="url(#d-arrow)" />
      {p > 0.02 && p < SENT ? (
        <circle cx={89} cy={50 + 20 * seg(p, 0.02, SENT)} r={4} className="d-packet" />
      ) : null}
      <rect
        x={44}
        y={74}
        width={90}
        height={30}
        rx={8}
        className={thinking ? 'd-busy' : 'd-device'}
      />
      <text x={89} y={93} textAnchor="middle" className={thinking ? 'd-on-busy' : 'd-small'}>
        {thinking ? 'thinking…' : 'AI model'}
      </text>
      <line x1={89} y1={106} x2={89} y2={122} className="d-axis" markerEnd="url(#d-arrow)" />
      <rect x={14} y={126} width={170} height={84} rx={10} className="d-bubble" />
      {lines.map((text, i) => (
        <text key={i} x={24} y={146 + i * 16} className="d-small">
          {text}
          {i === lines.length - 1 && p < DONE ? '▍' : ''}
        </text>
      ))}

      <Timer
        x={210}
        y={30}
        ms={seg(p, SENT, FIRST) * FIRST_TOKEN_MS}
        label={p >= FIRST ? 'First word (first token)' : 'Waiting for a word…'}
        tone={p >= FIRST ? 'good' : 'text'}
      />
      <text x={210} y={110} className="d-label">
        Cost of this answer
      </text>
      <text x={210} y={136} className="d-timer d-small-timer">
        ${cost.toFixed(4)}
      </text>
      <text x={210} y={162} className="d-small">
        {shownWords} words streamed
      </text>
      <text x={210} y={196} className="d-note">
        × every user, every day
      </text>
    </g>
  )
}

function wrap(words: string[], width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && (line + ' ' + word).length > width) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}
