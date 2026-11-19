export interface Product {
  id: string
  name: string
  priceCents: number
  image: string
  addedAt: string
}

export interface CartLine {
  product: Product
  quantity: number
}
