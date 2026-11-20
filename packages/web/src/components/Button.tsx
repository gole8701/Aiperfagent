import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'

type Variant = 'default' | 'primary' | 'ai' | 'danger' | 'link'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  small?: boolean
  busy?: boolean
}

export function Button({
  variant = 'default',
  small,
  busy,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    small ? 'btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

interface LinkButtonProps {
  to: string
  variant?: Variant
  small?: boolean
  children: ReactNode
  className?: string
  'data-tour'?: string
}

export function LinkButton({
  to,
  variant = 'default',
  small,
  children,
  className = '',
  ...rest
}: LinkButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    small ? 'btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <Link to={to} className={classes} {...rest}>
      {children}
    </Link>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  return (
    <Button
      small
      onClick={(event) => {
        void navigator.clipboard.writeText(text)
        const target = event.currentTarget
        target.textContent = 'Copied'
        setTimeout(() => {
          target.textContent = label
        }, 1200)
      }}
    >
      {label}
    </Button>
  )
}
