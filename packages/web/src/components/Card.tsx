import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  'data-tour'?: string
  id?: string
}

export function Card({ title, action, children, className = '', ...rest }: CardProps) {
  return (
    <section className={`card ${className}`} {...rest}>
      {title || action ? (
        <div className="card-title">
          {typeof title === 'string' ? <h3 className="label">{title}</h3> : title}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="row" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{label}…</span>
    </span>
  )
}

export function ErrorBox({
  error,
  action,
}: {
  error: { message: string; hint?: string }
  action?: ReactNode
}) {
  return (
    <div className="error-box" role="alert">
      <strong>{error.message}</strong>
      {error.hint ? <div className="muted">{error.hint}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function SeverityDot({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const label = { critical: 'Critical', warning: 'Warning', info: 'Info' }[severity]
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      <span className={`dot dot-${severity}`} aria-hidden="true" />
      <span className={`sev-${severity}`}>{label}</span>
    </span>
  )
}

export function Progress({ fraction, label }: { fraction: number; label: string }) {
  return (
    <div aria-live="polite">
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
    </div>
  )
}
