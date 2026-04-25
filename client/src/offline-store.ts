import type { Customer, Equipment, LaborRate, QuoteWithDetails } from "./types.ts"

type CachedResourceMap = {
  customers: Customer[]
  equipment: Equipment[]
  laborRates: LaborRate[]
  quotes: QuoteWithDetails[]
}

type CachedResourceKey = keyof CachedResourceMap

type CachedResourceRecord<K extends CachedResourceKey = CachedResourceKey> = {
  key: K
  value: CachedResourceMap[K]
  updatedAt: string
}

type PendingQuoteRecord = {
  id: string
  quote: QuoteWithDetails
  queuedAt: string
}

const DATABASE_NAME = "hvac-quotes-offline"
const DATABASE_VERSION = 1
const CACHE_STORE = "cachedResources"
const PENDING_QUOTES_STORE = "pendingQuotes"

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.addEventListener("upgradeneeded", () => {
      const database = request.result

      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: "key" })
      }

      if (!database.objectStoreNames.contains(PENDING_QUOTES_STORE)) {
        database.createObjectStore(PENDING_QUOTES_STORE, { keyPath: "id" })
      }
    })

    request.addEventListener("success", () => {
      resolve(request.result)
    })

    request.addEventListener("error", () => {
      reject(request.error ?? new Error("Unable to open offline database."))
    })
  })

  return databasePromise
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result)
    })

    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed."))
    })
  })
}

async function completeTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve())
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted.")))
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed.")))
  })
}

export async function getCachedResource<K extends CachedResourceKey>(
  key: K,
): Promise<CachedResourceMap[K] | null> {
  const database = await openDatabase()
  const transaction = database.transaction(CACHE_STORE, "readonly")
  const store = transaction.objectStore(CACHE_STORE)
  const record = (await readRequest(
    store.get(key),
  )) as CachedResourceRecord<K> | undefined

  return record?.value ?? null
}

export async function setCachedResource<K extends CachedResourceKey>(
  key: K,
  value: CachedResourceMap[K],
): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(CACHE_STORE, "readwrite")
  const store = transaction.objectStore(CACHE_STORE)

  store.put({
    key,
    value,
    updatedAt: new Date().toISOString(),
  } satisfies CachedResourceRecord<K>)

  await completeTransaction(transaction)
}

export async function getStoredQuote(id: string): Promise<QuoteWithDetails | null> {
  const quotes = await getStoredQuotes()
  return quotes.find((quote) => quote.id === id) ?? null
}

export async function getStoredQuotes(): Promise<QuoteWithDetails[]> {
  return (await getCachedResource("quotes")) ?? []
}

export async function putStoredQuote(quote: QuoteWithDetails): Promise<void> {
  const quotes = await getStoredQuotes()
  const nextQuotes = [...quotes]
  const existingIndex = nextQuotes.findIndex((item) => item.id === quote.id)

  if (existingIndex >= 0) {
    nextQuotes[existingIndex] = quote
  } else {
    nextQuotes.push(quote)
  }

  await setCachedResource("quotes", nextQuotes)
}

export async function putStoredQuotes(quotes: QuoteWithDetails[]): Promise<void> {
  await setCachedResource("quotes", quotes)
}

export async function removeStoredQuote(id: string): Promise<void> {
  const quotes = await getStoredQuotes()
  await setCachedResource(
    "quotes",
    quotes.filter((quote) => quote.id !== id),
  )
}

export async function queuePendingQuote(quote: QuoteWithDetails): Promise<void> {
  await putStoredQuote(quote)

  const database = await openDatabase()
  const transaction = database.transaction(PENDING_QUOTES_STORE, "readwrite")

  transaction.objectStore(PENDING_QUOTES_STORE).put({
    id: quote.id,
    quote,
    queuedAt: new Date().toISOString(),
  } satisfies PendingQuoteRecord)

  await completeTransaction(transaction)
}

export async function getPendingQuotes(): Promise<QuoteWithDetails[]> {
  const database = await openDatabase()
  const transaction = database.transaction(PENDING_QUOTES_STORE, "readonly")
  const store = transaction.objectStore(PENDING_QUOTES_STORE)
  const records = (await readRequest(store.getAll())) as PendingQuoteRecord[]

  return [...records].sort((left, right) => left.queuedAt.localeCompare(right.queuedAt)).map((record) => record.quote)
}

export async function removePendingQuote(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(PENDING_QUOTES_STORE, "readwrite")
  transaction.objectStore(PENDING_QUOTES_STORE).delete(id)
  await completeTransaction(transaction)
}
