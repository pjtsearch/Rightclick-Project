import type { Customer, QuoteWithDetails } from "./types.ts"

export const emptyCustomer: Customer = {
  id: "",
  name: "",
  address: "",
  phone: null,
  propertyType: null,
  squareFootage: null,
  systemType: null,
  systemAge: null,
  lastServiceDate: null,
}

export const emptyQuote: QuoteWithDetails = {
  id: "",
  surcharge: 0,
  date: "",
  accomplished: false,
  customer: { ...emptyCustomer },
  equipments: [],
  labors: [],
}

export function generateNewCustomer(): Customer {
  return {
    ...emptyCustomer,
    id: globalThis.crypto.randomUUID(),
  }
}

export function generateNewQuote(): QuoteWithDetails {
  const id = globalThis.crypto.randomUUID()

  return {
    ...emptyQuote,
    id,
  }
}
