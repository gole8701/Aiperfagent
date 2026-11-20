import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  width?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  selectedKey?: string
  caption: string
  empty?: ReactNode
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  caption,
  empty,
}: TableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="muted">
                {empty ?? 'Nothing to show'}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const key = rowKey(row)
            const clickable = Boolean(onRowClick)
            return (
              <tr
                key={key}
                className={[
                  clickable ? 'clickable' : '',
                  selectedKey === key ? 'selected' : '',
                ].join(' ')}
                tabIndex={clickable ? 0 : undefined}
                aria-selected={selectedKey === key || undefined}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(event) => {
                  if (clickable && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    onRowClick?.(row)
                  }
                }}
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.render(row)}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
