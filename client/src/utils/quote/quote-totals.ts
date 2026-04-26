import type { QuoteWithDetails } from "../../types/databaseTypes.ts"

export function getQuoteEquipmentTotal(quote: QuoteWithDetails): number {
  return quote.equipments.reduce((total, item) => total + item.price * item.quantity, 0)
}

export function getLaborTotal(quote: QuoteWithDetails): number {
  return quote.labors.reduce((total, item) => total + item.price * item.hours, 0)
}

export function getQuoteSubtotal(quote: QuoteWithDetails): number {
  return getQuoteEquipmentTotal(quote) + getLaborTotal(quote)
}

export function getQuoteTotal(quote: QuoteWithDetails): number {
  return getQuoteSubtotal(quote) * (1 + quote.surcharge / 100)
}
