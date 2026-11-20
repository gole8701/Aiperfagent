import type { ReactNode } from 'react'

interface ChipProps {
  label: ReactNode
  count?: number
  active: boolean
  onClick: () => void
  title?: string
}

export function Chip({ label, count, active, onClick, title }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick} title={title}>
      {label}
      {count !== undefined ? <span className="chip-count">{count}</span> : null}
    </button>
  )
}
