import {
  getCachedResource,
  getPendingQuotes,
  getStoredQuote,
  getStoredQuotes,
  putStoredQuote,
  putStoredQuotes,
  queuePendingQuote,
  removeStoredQuote,
  removePendingQuote,
  setCachedResource,
} from "./offline-store.ts"
import { getLocalDateString } from "./quote-date.ts"
import type { Customer, Equipment, LaborRate, QuoteWithDetails } from "./types.ts"

export const quotesSyncedEvent = "quotes-synced"

async function readJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)

  if (!response.ok) {
    throw new Error(`Request failed for ${path} (${response.status})`)
  }

  return (await response.json()) as T
}

function emitQuotesSynced(): void {
  window.dispatchEvent(new Event(quotesSyncedEvent))
}

function withSyncStatus(quote: QuoteWithDetails, syncStatus: QuoteWithDetails["syncStatus"]): QuoteWithDetails {
  return {
    ...quote,
    syncStatus,
  }
}

function withSavedTimestamp(quote: QuoteWithDetails): QuoteWithDetails {
  return {
    ...quote,
    date: new Date().toISOString(),
  }
}

function isOfflineError(error: unknown): boolean {
  return error instanceof TypeError
}

async function postQuote(quote: QuoteWithDetails): Promise<QuoteWithDetails> {
  return readJson<QuoteWithDetails>("/api/quotes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(quote),
  })
}

async function deleteQuoteRequest(id: string): Promise<void> {
  const response = await fetch(`/api/quotes/${id}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error(`Request failed for /api/quotes/${id} (${response.status})`)
  }
}

async function markQuoteAccomplishedRequest(id: string, serviceDate: string): Promise<QuoteWithDetails> {
  return readJson<QuoteWithDetails>(`/api/quotes/${id}/accomplish`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ serviceDate }),
  })
}

async function readCachedCollection<T>(key: "customers" | "equipment" | "laborRates"): Promise<T | null> {
  return (await getCachedResource(key)) as T | null
}

async function fetchCachedCollection<T>(
  path: string,
  key: "customers" | "equipment" | "laborRates",
): Promise<T> {
  try {
    const value = await readJson<T>(path)
    await setCachedResource(key, value as Customer[] & Equipment[] & LaborRate[])
    return value
  } catch (error) {
    const cachedValue = await readCachedCollection<T>(key)

    if (cachedValue !== null) {
      return cachedValue
    }

    throw error
  }
}

export async function fetchQuotes(): Promise<QuoteWithDetails[]> {
  if (navigator.onLine) {
    try {
      const quotes = await readJson<QuoteWithDetails[]>("/api/quotes")
      await putStoredQuotes(quotes.map((quote) => withSyncStatus(quote, "synced")))
    } catch (error) {
      const cachedQuotes = await getStoredQuotes()

      if (cachedQuotes.length > 0) {
        return cachedQuotes
      }

      throw error
    }
  }

  const cachedQuotes = await getStoredQuotes()

  if (cachedQuotes.length > 0) {
    return cachedQuotes
  }

  return []
}

export async function fetchQuote(id: string): Promise<QuoteWithDetails> {
  const cachedQuote = await getStoredQuote(id)

  if (cachedQuote?.syncStatus === "pending") {
    return cachedQuote
  }

  try {
    const quote = await readJson<QuoteWithDetails>(`/api/quotes/${id}`)
    const syncedQuote = withSyncStatus(quote, "synced")
    await putStoredQuote(syncedQuote)
    return syncedQuote
  } catch (error) {
    if (cachedQuote) {
      return cachedQuote
    }

    throw error
  }
}

export function fetchCustomers(): Promise<Customer[]> {
  return fetchCachedCollection<Customer[]>("/api/customers", "customers")
}

export function fetchEquipment(): Promise<Equipment[]> {
  return fetchCachedCollection<Equipment[]>("/api/equipment", "equipment")
}

export function fetchLaborRates(): Promise<LaborRate[]> {
  return fetchCachedCollection<LaborRate[]>("/api/laborRates", "laborRates")
}

export async function fetchRealtimeClientSecret(): Promise<string> {
  const payload = await readJson<{ value?: string; client_secret?: { value?: string } }>(
    "/api/realtime/client-secret",
    {
      method: "POST",
    },
  )
  const clientSecret = payload.client_secret?.value ?? payload.value

  if (!clientSecret) {
    throw new Error("Realtime client secret response did not include a client secret.")
  }

  return clientSecret
}

export async function createQuote(quote: QuoteWithDetails): Promise<QuoteWithDetails> {
  const quoteToSave = withSavedTimestamp(quote)

  try {
    if (!navigator.onLine) {
      throw new TypeError("Offline")
    }

    const savedQuote = withSyncStatus(await postQuote(quoteToSave), "synced")
    await putStoredQuote(savedQuote)
    await removePendingQuote(savedQuote.id)
    return savedQuote
  } catch (error) {
    if (!isOfflineError(error)) {
      throw error
    }

    const pendingQuote = withSyncStatus(quoteToSave, "pending")
    await queuePendingQuote(pendingQuote)
    return pendingQuote
  }
}

export async function deleteQuote(id: string): Promise<void> {
  const storedQuote = await getStoredQuote(id)

  if (storedQuote?.syncStatus === "pending") {
    await removePendingQuote(id)
    await removeStoredQuote(id)
    emitQuotesSynced()
    return
  }

  await deleteQuoteRequest(id)
  await removeStoredQuote(id)
  await removePendingQuote(id)
  emitQuotesSynced()
}

export async function markQuoteAccomplished(id: string): Promise<QuoteWithDetails> {
  const storedQuote = await getStoredQuote(id)

  if (!storedQuote) {
    throw new Error(`Quote ${id} was not found.`)
  }

  const serviceDate = getLocalDateString()

  if (storedQuote.syncStatus === "pending") {
    const updatedQuote = withSyncStatus(
      {
        ...storedQuote,
        accomplished: true,
        customer: {
          ...storedQuote.customer,
          lastServiceDate: serviceDate,
        },
      },
      "pending",
    )

    await queuePendingQuote(updatedQuote)

    const cachedCustomers = await getCachedResource("customers")

    if (cachedCustomers) {
      await setCachedResource(
        "customers",
        cachedCustomers.map((customer) =>
          customer.id === updatedQuote.customer.id
            ? {
                ...customer,
                lastServiceDate: serviceDate,
              }
            : customer,
        ),
      )
    }

    emitQuotesSynced()
    return updatedQuote
  }

  const updatedQuote = withSyncStatus(await markQuoteAccomplishedRequest(id, serviceDate), "synced")
  await putStoredQuote(updatedQuote)

  const cachedCustomers = await getCachedResource("customers")

  if (cachedCustomers) {
    await setCachedResource(
      "customers",
      cachedCustomers.map((customer) => (customer.id === updatedQuote.customer.id ? updatedQuote.customer : customer)),
    )
  }

  emitQuotesSynced()
  return updatedQuote
}

export async function syncPendingQuotes(): Promise<void> {
  if (!navigator.onLine) {
    return
  }

  const pendingQuotes = await getPendingQuotes()
  let didUpdateQuotes = false

  for (const quote of pendingQuotes) {
    try {
      const savedQuote = withSyncStatus(await postQuote(quote), "synced")
      await putStoredQuote(savedQuote)
      await removePendingQuote(quote.id)
      didUpdateQuotes = true
    } catch (error) {
      if (isOfflineError(error)) {
        break
      }

      console.error("Unable to sync pending quote", error)
      break
    }
  }

  if (didUpdateQuotes) {
    emitQuotesSynced()
  }
}

export function startOfflineSupport(): void {
  window.addEventListener("online", () => {
    void syncPendingQuotes()
  })

  void syncPendingQuotes()
}
