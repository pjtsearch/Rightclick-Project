export type Customer = {
  id: string
  name: string
  address: string
  phone: string | null
  propertyType: string | null
  squareFootage: number | null
  systemType: string | null
  systemAge: number | null
  lastServiceDate: string | null
}

export type QuoteLineType = "equipment" | "labor" | "other"

export type QuoteLine = {
  quoteId: number
  type: QuoteLineType
  ordering: number
  price: number
  equipmentId: string | null
  laborId: string | null
  hours: number | null
  name: string | null
}

export type QuoteWithDetails = {
  id: number
  surcharge: number
  date: string
  customer: Customer
  lines: QuoteLine[]
}
