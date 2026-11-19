import { useState } from 'react'

import { ChatWidget } from './ChatWidget'
import { useCart } from '../context/CartContext'

export function Header({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { lines } = useCart()
  const [chatOpen, setChatOpen] = useState(false)
  const count = lines.reduce((n, l) => n + l.quantity, 0)

  return (
    <header className="header">
      <strong>Demo Shop</strong>
      <nav>
        <button type="button" onClick={() => onNavigate('/')}>
          Home
        </button>
        <button type="button" onClick={() => onNavigate('/checkout')}>
          Checkout ({count})
        </button>
        <button type="button" onClick={() => setChatOpen((open) => !open)}>
          Help
        </button>
      </nav>
      {/* Problem 12: the chat widget is imported statically but only shown on demand */}
      {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />}
    </header>
  )
}
