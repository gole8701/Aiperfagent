import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '../components/Button'
import { InfoLink } from '../components/Fields'
import { useDisplay } from '../state/theme'

import type { ChartContext, ChartDefinition } from './definitions/types'
import { echarts } from './echarts'

interface ChartProps {
  definition: ChartDefinition
  ctx: ChartContext
}

/** One wrapper for every chart: question, how-to-read, the drawing, the takeaway, export, "i" link, theme and reduced motion. */
export function Chart({ definition, ctx }: ChartProps) {
  const navigate = useNavigate()
  const sample = definition.sample?.(ctx)
  const [error, setError] = useState<string>()
  const instance = useRef<echarts.ECharts>(null)

  function exportPng(): void {
    const url = instance.current?.getDataURL({ pixelRatio: 2, backgroundColor: ctx.palette.panel })
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `perfagent-${definition.id}.png`
    link.click()
  }

  return (
    <section className="card chart-card" aria-labelledby={`chart-${definition.id}`} data-chart={definition.id}>
      <div className="card-title" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 id={`chart-${definition.id}`} style={{ fontSize: '1.05em' }}>
            {definition.question}
          </h3>
          <div className="muted" style={{ fontSize: 12 }}>
            {definition.howToRead}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <InfoLink topic={definition.guide} what={definition.question} />
          {definition.kind === 'echarts' ? (
            <Button small onClick={exportPng} aria-label={`Export "${definition.question}" as PNG`}>
              PNG
            </Button>
          ) : null}
        </div>
      </div>
      {sample ? (
        <div className="badge badge-warning" style={{ marginBottom: 8 }}>
          Sample data · {sample}
        </div>
      ) : null}
      {error ? <div className="error-box">{error}</div> : <Body definition={definition} ctx={ctx} instance={instance} onError={setError} onClick={(click) => void navigate(click.issueId ? `/issues/${encodeURIComponent(click.issueId)}` : `/?filter=${click.filter ?? 'all'}`)} />}
      <p className="chart-takeaway">
        <strong>What this means:</strong> {definition.takeaway(ctx)}
      </p>
    </section>
  )
}

interface BodyProps extends ChartProps {
  instance: React.RefObject<echarts.ECharts | null>
  onError: (message: string) => void
  onClick: (click: { issueId?: string; filter?: string }) => void
}

function Body({ definition, ctx, instance, onError, onClick }: BodyProps) {
  if (definition.kind === 'summary') {
    const s = definition.build(ctx)
    return (
      <div>
        <div style={{ fontSize: '1.2em', fontWeight: 600, marginBottom: 6 }}>{s.headline}</div>
        {s.sentences.map((sentence, i) => (
          <p key={i} style={{ margin: '0 0 4px' }}>
            {sentence}
          </p>
        ))}
      </div>
    )
  }
  if (definition.kind === 'tiles') {
    return (
      <div className="tiles">
        {definition.build(ctx).map((tile) => (
          <div key={tile.label} className={`tile ${tile.rating ? `rating-${tile.rating}` : ''}`}>
            <span className="label">{tile.label}</span>
            <strong>{tile.value}</strong>
            <span className="muted">{tile.note}</span>
          </div>
        ))}
      </div>
    )
  }
  if (definition.kind === 'filmstrip') {
    const { frames } = definition.build(ctx)
    return frames.length ? (
      <div className="filmstrip" role="list">
        {frames.map((frame, i) => (
          <figure key={i} role="listitem">
            {frame.image ? <img src={frame.image} alt={`Screen at ${(frame.timeMs / 1000).toFixed(1)} seconds`} /> : <div className="filmstrip-empty" aria-hidden="true" />}
            <figcaption>{(frame.timeMs / 1000).toFixed(1)} s</figcaption>
          </figure>
        ))}
      </div>
    ) : (
      <div className="muted">No screenshots in this scan.</div>
    )
  }
  return <EChart definition={definition} ctx={ctx} instance={instance} onError={onError} onClick={onClick} />
}

function EChart({ definition, ctx, instance, onError, onClick }: BodyProps & { definition: Extract<ChartDefinition, { kind: 'echarts' }> }) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useDisplay((s) => s.reducedMotion)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    instance.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(el)
    chart.on('click', (params) => {
      const click = definition.onClick?.({ name: params.name, dataIndex: params.dataIndex, seriesName: params.seriesName }, ctx)
      if (click) onClick(click)
    })
    return () => {
      observer.disconnect()
      chart.dispose()
      instance.current = null
    }
    // The chart instance lives as long as the element; options are pushed in the effect below.
  }, [])

  useEffect(() => {
    try {
      instance.current?.setOption({ animation: !reducedMotion, backgroundColor: 'transparent', ...definition.build(ctx) }, true)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'This chart could not be drawn')
    }
  }, [definition, ctx, reducedMotion, instance, onError])

  return <div ref={ref} style={{ height: definition.height ?? 280 }} role="img" aria-label={`${definition.question} ${definition.takeaway(ctx)}`} />
}
