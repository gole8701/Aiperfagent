import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import type { CartLine, Product } from '../lib/types'

interface CartState {
  lines: CartLine[]
  coupon: string
  setCoupon: (value: string) => void
  add: (product: Product) => void
}

const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [coupon, setCoupon] = useState('')

  const value = useMemo<CartState>(
    () => ({
      lines,
      coupon,
      setCoupon,
      add: (product) =>
        setLines((current) => {
          const existing = current.find((l) => l.product.id === product.id)
          if (existing) return current.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
          return [...current, { product, quantity: 1 }]
        }),
    }),
    [lines, coupon],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const state = useContext(CartContext)
  if (!state) throw new Error('useCart must be used inside CartProvider')
  return state
}
