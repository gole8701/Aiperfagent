import { ProductCard } from './ProductCard'
import type { Product } from '../lib/types'

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <section className="grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </section>
  )
}
