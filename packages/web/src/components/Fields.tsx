import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface SelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  hideLabel?: boolean
  disabled?: boolean
}

export function Select({ label, value, options, onChange, hideLabel, disabled }: SelectProps) {
  return (
    <label className="field">
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <select
        className="select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={hideLabel ? label : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface ToggleProps {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  disabled?: boolean
}

export function Toggle({ label, checked, onChange, description, disabled }: ToggleProps) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span>
        {label}
        {description ? (
          <span className="muted" style={{ display: 'block', fontSize: 12 }}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'password' | 'url'
  placeholder?: string
  description?: string
  hideLabel?: boolean
  onBlur?: () => void
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  description,
  hideLabel,
  onBlur,
}: TextFieldProps) {
  return (
    <label className="field">
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-label={hideLabel ? label : undefined}
      />
      {description ? <span>{description}</span> : null}
    </label>
  )
}

/** The "i" button next to a metric or chart: opens the guide at that topic. */
export function InfoLink({ topic, what }: { topic: string; what: string }) {
  return (
    <Link
      to={`/guide/${topic}`}
      className="info-link"
      aria-label={`What is ${what}? Open the guide`}
      title={`How to read ${what}`}
    >
      i
    </Link>
  )
}
