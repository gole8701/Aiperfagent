import { useCart } from '../context/CartContext'
import { formatAdded, formatPrice } from '../lib/dates'
import type { Product } from '../lib/types'

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart()
  return (
    <article className="card">
      {/* Problem 11: no width/height, so the grid jumps as each picture arrives */}
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{formatPrice(product.priceCents)}</p>
      <small>Added {formatAdded(product.addedAt)}</small>
      <button className="primary" type="button" onClick={() => add(product)}>
        Add to cart
      </button>
    </article>
  )
}
