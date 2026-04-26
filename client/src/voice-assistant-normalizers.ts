import { createEmptyCustomer } from "./quote-draft.ts"
import type { Customer, QuoteEquipment, QuoteLabor, QuoteWithDetails } from "./types.ts"
import type { QuoteVoiceUpdatePayload, VoiceAssistantAction, VoiceAssistantContext } from "./voice-assistant.ts"
import { normalizeNullableNumber, normalizeNullableString, normalizeString } from "./voice-assistant.ts"

export function normalizeQuote(
  quotePatch: QuoteVoiceUpdatePayload["quote"],
  context: VoiceAssistantContext,
): QuoteWithDetails {
  const nextQuote: QuoteWithDetails = {
    ...context.quote,
    customer: { ...context.quote.customer },
    equipments: [...context.quote.equipments],
    labors: [...context.quote.labors],
  }

  if (!quotePatch) {
    return nextQuote
  }

  if (typeof quotePatch.date === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(quotePatch.date)) {
    nextQuote.date = quotePatch.date
  }

  if (typeof quotePatch.surcharge === "number" && Number.isFinite(quotePatch.surcharge)) {
    nextQuote.surcharge = Math.max(0, quotePatch.surcharge)
  }

  if (quotePatch.customer && typeof quotePatch.customer === "object") {
    nextQuote.customer = normalizeCustomer(quotePatch.customer, context)
  }

  if (Array.isArray(quotePatch.equipments)) {
    nextQuote.equipments = normalizeEquipments(quotePatch.equipments, context)
  }

  if (Array.isArray(quotePatch.labors)) {
    nextQuote.labors = normalizeLabors(quotePatch.labors, context)
  }

  return nextQuote
}

export function normalizeNewCustomer(
  customerPatch: Partial<Customer> | null | undefined,
  context: VoiceAssistantContext,
): Customer | null {
  if (!customerPatch || typeof customerPatch !== "object") {
    return null
  }

  const currentCustomer = context.newCustomer
  const generatedCustomer = createEmptyCustomer()
  const customerId = typeof customerPatch.id === "string" && customerPatch.id.trim() ? customerPatch.id.trim() : null

  return {
    ...currentCustomer,
    id: customerId ?? currentCustomer.id ?? generatedCustomer.id,
    name: normalizeString(customerPatch.name, currentCustomer.name),
    address: normalizeString(customerPatch.address, currentCustomer.address),
    phone: normalizeNullableString(customerPatch.phone, currentCustomer.phone),
    propertyType: normalizeNullableString(customerPatch.propertyType, currentCustomer.propertyType),
    squareFootage: normalizeNullableNumber(customerPatch.squareFootage, currentCustomer.squareFootage),
    systemType: normalizeNullableString(customerPatch.systemType, currentCustomer.systemType),
    systemAge: normalizeNullableNumber(customerPatch.systemAge, currentCustomer.systemAge),
    lastServiceDate: normalizeNullableString(customerPatch.lastServiceDate, currentCustomer.lastServiceDate),
  }
}

export function normalizeAssistantAction(
  payload: QuoteVoiceUpdatePayload,
  context: VoiceAssistantContext,
): VoiceAssistantAction | null {
  const explicitAction = payload.ui

  if (
    explicitAction &&
    (explicitAction.stage ||
      typeof explicitAction.openNewCustomerDialog === "boolean" ||
      explicitAction.confirmNewCustomer === true ||
      explicitAction.saveQuote === true)
  ) {
    if (
      context.newCustomerDialogIsOpen &&
      explicitAction.stage === "equipment" &&
      explicitAction.confirmNewCustomer !== true
    ) {
      // Moving from the dialog to equipment almost always means "accept this draft customer and continue".
      return {
        ...explicitAction,
        confirmNewCustomer: true,
      }
    }

    return {
      stage: explicitAction.stage,
      openNewCustomerDialog: explicitAction.openNewCustomerDialog,
      confirmNewCustomer: explicitAction.confirmNewCustomer,
      saveQuote: explicitAction.saveQuote,
    }
  }

  if (payload.quote?.labors) {
    return { stage: "labor" }
  }

  if (payload.quote?.equipments) {
    return { stage: "equipment" }
  }

  if (payload.quote?.customer) {
    if (context.newCustomerDialogIsOpen) {
      return { stage: "equipment", confirmNewCustomer: true }
    }

    const customerPatch = payload.quote.customer
    const customerId =
      typeof customerPatch.id === "string" && customerPatch.id.trim() ? customerPatch.id.trim() : null
    const customerName =
      typeof customerPatch.name === "string" && customerPatch.name.trim()
        ? customerPatch.name.trim().toLowerCase()
        : null
    const matchedCustomer =
      (customerId && context.customers.find((customer) => customer.id === customerId)) ||
      (customerName &&
        context.customers.find((customer) => customer.name.trim().toLowerCase() === customerName)) ||
      null

    if (matchedCustomer) {
      return { stage: "equipment" }
    }

    return { stage: "customer", openNewCustomerDialog: true }
  }

  if (payload.newCustomer) {
    return { stage: "customer", openNewCustomerDialog: true }
  }

  return null
}

function normalizeCustomer(customerPatch: Partial<Customer>, context: VoiceAssistantContext): Customer {
  const customerId = typeof customerPatch.id === "string" && customerPatch.id.trim() ? customerPatch.id.trim() : null
  const customerName =
    typeof customerPatch.name === "string" && customerPatch.name.trim()
      ? customerPatch.name.trim().toLowerCase()
      : null

  if (customerId) {
    const matchedCustomer = context.customers.find((customer) => customer.id === customerId)

    if (matchedCustomer) {
      return matchedCustomer
    }
  }

  if (customerName) {
    const matchedCustomer = context.customers.find((customer) => customer.name.trim().toLowerCase() === customerName)

    if (matchedCustomer) {
      return matchedCustomer
    }
  }

  const currentCustomer = context.quote.customer
  const generatedCustomer = createEmptyCustomer()

  return {
    ...currentCustomer,
    id: customerId ?? currentCustomer.id ?? generatedCustomer.id,
    name: normalizeString(customerPatch.name, currentCustomer.name),
    address: normalizeString(customerPatch.address, currentCustomer.address),
    phone: normalizeNullableString(customerPatch.phone, currentCustomer.phone),
    propertyType: normalizeNullableString(customerPatch.propertyType, currentCustomer.propertyType),
    squareFootage: normalizeNullableNumber(customerPatch.squareFootage, currentCustomer.squareFootage),
    systemType: normalizeNullableString(customerPatch.systemType, currentCustomer.systemType),
    systemAge: normalizeNullableNumber(customerPatch.systemAge, currentCustomer.systemAge),
    lastServiceDate: normalizeNullableString(customerPatch.lastServiceDate, currentCustomer.lastServiceDate),
  }
}

function normalizeEquipments(
  equipmentSelections: Array<{
    equipmentId?: unknown
    quantity?: unknown
  }>,
  context: VoiceAssistantContext,
): QuoteEquipment[] {
  // The assistant sends the full desired equipment list, so we rebuild the section from scratch.
  const nextSelections = new Map<string, QuoteEquipment>()

  for (const selection of equipmentSelections) {
    const equipmentId = typeof selection.equipmentId === "string" ? selection.equipmentId : ""
    const catalogItem = context.equipment.find((item) => item.id === equipmentId)

    if (!catalogItem) {
      continue
    }

    const quantity = Math.max(0, Math.trunc(Number(selection.quantity ?? 0)))

    if (quantity <= 0) {
      nextSelections.delete(equipmentId)
      continue
    }

    nextSelections.set(equipmentId, {
      quoteId: context.quote.id,
      equipmentId,
      quantity,
      price: catalogItem.baseCost,
    })
  }

  return [...nextSelections.values()]
}

function normalizeLabors(
  laborSelections: Array<{
    laborId?: unknown
    hours?: unknown
  }>,
  context: VoiceAssistantContext,
): QuoteLabor[] {
  // Labor hours are normalized to 0.5-hour increments to match the stepper behavior in the UI.
  const nextSelections = new Map<string, QuoteLabor>()

  for (const selection of laborSelections) {
    const laborId = typeof selection.laborId === "string" ? selection.laborId : ""
    const catalogItem = context.laborRates.find((item) => item.jobId === laborId)

    if (!catalogItem) {
      continue
    }

    const rawHours = Number(selection.hours ?? 0)
    const hours = Math.max(0, Math.round(rawHours * 2) / 2)

    if (hours <= 0) {
      nextSelections.delete(laborId)
      continue
    }

    nextSelections.set(laborId, {
      quoteId: context.quote.id,
      laborId,
      hours,
      price: catalogItem.hourlyRate,
    })
  }

  return [...nextSelections.values()]
}
