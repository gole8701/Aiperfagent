import { useEffect, useState } from 'react'

import { CartSummary } from './components/CartSummary'
import { Header } from './components/Header'
import { HeroBanner } from './components/HeroBanner'
import { LiveStock } from './components/LiveStock'
import { ProductGrid } from './components/ProductGrid'
import { CartProvider } from './context/CartContext'
import { connect } from './lib/socket'
import type { Product } from './lib/types'

export function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [route, setRoute] = useState(window.location.pathname)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data))
    connect()
  }, [])

  const go = (path: string) => {
    window.history.pushState({}, '', path)
    setRoute(path)
  }

  return (
    <CartProvider>
      <Header onNavigate={go} />
      {route === '/checkout' ? (
        <main className="page">
          <h1>Checkout</h1>
          <CartSummary />
        </main>
      ) : (
        <main className="page">
          <HeroBanner />
          <LiveStock />
          <ProductGrid products={products} />
        </main>
      )}
    </CartProvider>
  )
}
