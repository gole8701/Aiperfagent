import { useCart } from '../context/CartContext'
import { formatPrice } from '../lib/dates'

export function CartSummary() {
  // Problem 2: subscribes to the whole cart context, so every keystroke in the
  // coupon box re-renders this component and the full line list below it.
  const { lines, coupon, setCoupon } = useCart()

  const rows = lines.map((line) => ({
    ...line,
    total: line.product.priceCents * line.quantity,
    label: `${line.quantity} × ${line.product.name}`,
  }))
  const subtotal = rows.reduce((sum, row) => sum + row.total, 0)
  const discount = coupon.toUpperCase() === 'SUMMER10' ? Math.round(subtotal * 0.1) : 0

  return (
    <section className="cart">
      <label className="coupon">
        Coupon
        <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="SUMMER10" />
      </label>
      <ul className="cart-lines">
        {rows.map((row) => (
          <li key={row.product.id}>
            <span>{row.label}</span>
            <span>{formatPrice(row.total)}</span>
          </li>
        ))}
      </ul>
      <p className="cart-total">
        <span>Subtotal</span>
        <strong>{formatPrice(subtotal - discount)}</strong>
      </p>
      <button className="primary" type="button">
        Pay now
      </button>
    </section>
  )
}
