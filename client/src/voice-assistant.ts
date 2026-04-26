import type { Customer, Equipment, LaborRate, QuoteEquipment, QuoteLabor, QuoteWithDetails } from "./types"

export type QuoteStage = "customer" | "equipment" | "labor" | "finalize"

export type RealtimeEvent = {
  type?: string
  response_id?: string
  item?: {
    type?: string
    name?: string
    call_id?: string
    arguments?: string
  }
  response?: {
    id?: string
    status?: string
    output?: Array<{
      type?: string
      name?: string
      call_id?: string
      arguments?: string
    }>
  }
}

export type VoiceAssistantAction = {
  stage?: "customer" | "equipment" | "labor" | "finalize"
  openNewCustomerDialog?: boolean
  confirmNewCustomer?: boolean
  saveQuote?: boolean
}

export type QuoteVoiceUpdatePayload = {
  note?: string
  ui?: VoiceAssistantAction
  newCustomer?: Partial<Customer> | null
  quote?: Partial<QuoteWithDetails>
}

export type VoiceAssistantContext = {
  quote: QuoteWithDetails
  stage: QuoteStage
  newCustomer: Customer
  newCustomerDialogIsOpen: boolean
  customers: Customer[]
  equipment: Equipment[]
  laborRates: LaborRate[]
}

export function normalizeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return normalized || fallback
}

export function normalizeNullableString(value: unknown, fallback: string | null): string | null {
  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return normalized || null
}

export function normalizeNullableNumber(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback
  }

  return value
}
