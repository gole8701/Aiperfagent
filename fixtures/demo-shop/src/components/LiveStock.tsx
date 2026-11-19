import { useEffect, useState } from 'react'

export function LiveStock() {
  const [stock, setStock] = useState<Record<string, number>>({})

  // Problem 7: the interval is never cleared, so every visit to the home page
  // leaves another poller running in the background.
  useEffect(() => {
    setInterval(() => {
      fetch('/api/products')
        .then((r) => r.json())
        .then((products: { id: string }[]) => setStock(Object.fromEntries(products.map((p) => [p.id, Math.floor(Math.random() * 20)]))))
    }, 2000)
  }, [])

  return <p className="live-stock">{Object.keys(stock).length} products in stock right now</p>
}
