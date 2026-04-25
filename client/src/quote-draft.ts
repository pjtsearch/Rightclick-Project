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

export function createEmptyCustomer(): Customer {
  return {
    ...emptyCustomer,
    id: globalThis.crypto.randomUUID(),
  }
}

export function createEmptyQuote(): QuoteWithDetails {
  const id = globalThis.crypto.randomUUID()

  return {
    id,
    surcharge: 0,
    date: new Date().toISOString().slice(0, 10),
    customer: { ...emptyCustomer },
    equipments: [],
    labors: [],
  }
}
