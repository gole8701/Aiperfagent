// Problem 3: the whole date-fns library is imported for two functions.
import * as dateFns from 'date-fns'

export function formatAdded(iso: string): string {
  return dateFns.formatDistanceToNow(dateFns.parseISO(iso), { addSuffix: true })
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
