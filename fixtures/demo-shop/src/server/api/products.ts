import type { IncomingMessage, ServerResponse } from 'node:http'

const PRODUCTS = Array.from({ length: 24 }, (_, i) => ({
  id: `p${i + 1}`,
  name: ['Trail Runner', 'Canvas Tote', 'Steel Bottle', 'Wool Beanie', 'Linen Shirt', 'Desk Lamp'][i % 6] + ` ${i + 1}`,
  priceCents: 1999 + i * 350,
  image: `https://picsum.photos/seed/shop-${i}/480/320`,
  addedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
}))

export function productsHandler(_req: IncomingMessage, res: ServerResponse): void {
  // Simulated database latency.
  setTimeout(() => {
    // Problem 10: no Cache-Control, so every visit waits for the "database" again.
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(PRODUCTS))
  }, 350)
}

export function json(res: ServerResponse, body: unknown): void {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
