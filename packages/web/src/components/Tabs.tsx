import { NavLink } from 'react-router'

export interface TabItem {
  id: string
  label: string
  to?: string
}

interface TabsProps {
  items: TabItem[]
  active?: string
  onChange?: (id: string) => void
  label: string
}

/** Tabs are links when `to` is given (so every tab has a URL) and buttons otherwise. */
export function Tabs({ items, active, onChange, label }: TabsProps) {
  return (
    <nav className="tabs" role="tablist" aria-label={label}>
      {items.map((item) =>
        item.to ? (
          <NavLink
            key={item.id}
            to={item.to}
            role="tab"
            className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
            aria-selected={active === item.id}
          >
            {item.label}
          </NavLink>
        ) : (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={active === item.id}
            onClick={() => onChange?.(item.id)}
          >
            {item.label}
          </button>
        ),
      )}
    </nav>
  )
}
