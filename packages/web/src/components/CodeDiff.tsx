interface CodeDiffProps {
  before: string
  after: string
  file?: string
  beforeLabel?: string
  afterLabel?: string
}

export function CodeDiff({
  before,
  after,
  file,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: CodeDiffProps) {
  return (
    <div>
      {file ? (
        <div className="mono muted" style={{ fontSize: 12, marginBottom: 6 }}>
          {file}
        </div>
      ) : null}
      <div className="diff">
        <div>
          <div className="label">{beforeLabel}</div>
          <pre className="diff-before" aria-label={`${beforeLabel} code`}>
            {before || ' '}
          </pre>
        </div>
        <div>
          <div className="label">{afterLabel}</div>
          <pre className="diff-after" aria-label={`${afterLabel} code`}>
            {after || ' '}
          </pre>
        </div>
      </div>
    </div>
  )
}
