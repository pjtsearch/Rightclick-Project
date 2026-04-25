import type { Customer, Equipment, LaborRate, QuoteWithDetails } from "./types.ts"

async function readJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)

  if (!response.ok) {
    throw new Error(`Request failed for ${path} (${response.status})`)
  }

  return (await response.json()) as T
}

export function fetchQuotes(): Promise<QuoteWithDetails[]> {
  return readJson<QuoteWithDetails[]>("/api/quotes")
}

export function fetchQuote(id: string): Promise<QuoteWithDetails> {
  return readJson<QuoteWithDetails>(`/api/quotes/${id}`)
}

export function fetchCustomers(): Promise<Customer[]> {
  return readJson<Customer[]>("/api/customers")
}

export function fetchEquipment(): Promise<Equipment[]> {
  return readJson<Equipment[]>("/api/equipment")
}

export function fetchLaborRates(): Promise<LaborRate[]> {
  return readJson<LaborRate[]>("/api/laborRates")
}

export function createQuote(quote: QuoteWithDetails): Promise<QuoteWithDetails> {
  return readJson<QuoteWithDetails>("/api/quotes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(quote),
  })
}
