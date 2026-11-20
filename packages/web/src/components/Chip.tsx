import type { ReactNode } from 'react'

interface ChipProps {
  label: ReactNode
  count?: number
  active: boolean
  onClick: () => void
  title?: string
  disabled?: boolean
}

export function Chip({ label, count, active, onClick, title, disabled }: ChipProps) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      disabled={disabled ?? (count === 0 && !active)}
    >
      {label}
      {count !== undefined ? <span className="chip-count">{count}</span> : null}
    </button>
  )
}
