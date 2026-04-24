import express, { type Response } from "express"
import { resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { Customer, Equipment, LaborRate, Quote, QuoteLine } from "./databaseTypes.ts"

type QuoteWithDetails = Omit<Quote, "customer"> & {
  customer: Customer
  lines: QuoteLine[]
}

type QuoteRow = Quote

function getDbPathFromArg(): string {
  const outputPath = process.argv[2]

  if (!outputPath) {
    console.error("Usage: node server.ts <database-file>")
    process.exit(1)
  }

  return resolve(process.cwd(), outputPath)
}

const emptyCustomer: Omit<Customer, "id"> = {
  name: "",
  address: "",
  phone: null,
  propertyType: null,
  squareFootage: null,
  systemType: null,
  systemAge: null,
  lastServiceDate: null,
}

function mergeCustomer(input: Partial<Customer> & Pick<Customer, "id">, existing?: Customer): Customer {
  return {
    ...emptyCustomer,
    ...existing,
    ...input,
    id: input.id,
  }
}

function normalizeQuoteLines(lines: QuoteLine[], quoteId: number): QuoteLine[] {
  return lines.map((line) => ({
    quoteId,
    ordering: line.ordering,
    type: line.type,
    price: line.price,
    equipmentId: line.type === "equipment" ? line.equipmentId : null,
    laborId: line.type === "labor" ? line.laborId : null,
    hours: line.type === "labor" ? line.hours : null,
    name: line.type === "other" ? line.name : null,
  }))
}

export function createDatabaseHelpers(database: DatabaseSync) {
  database.exec("PRAGMA foreign_keys = ON;")

  const statements = {
    getCustomer: database.prepare(`SELECT * FROM "customers" WHERE "id" = ?`),
    getAllCustomers: database.prepare(`SELECT * FROM "customers" ORDER BY "id"`),
    upsertCustomer: database.prepare(`
      INSERT INTO "customers" (
        "id",
        "name",
        "address",
        "phone",
        "propertyType",
        "squareFootage",
        "systemType",
        "systemAge",
        "lastServiceDate"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT("id") DO UPDATE SET
        "name" = excluded."name",
        "address" = excluded."address",
        "phone" = excluded."phone",
        "propertyType" = excluded."propertyType",
        "squareFootage" = excluded."squareFootage",
        "systemType" = excluded."systemType",
        "systemAge" = excluded."systemAge",
        "lastServiceDate" = excluded."lastServiceDate";
    `),
    deleteCustomer: database.prepare(`DELETE FROM "customers" WHERE "id" = ?`),
    getAllEquipment: database.prepare(`SELECT * FROM "equipment" ORDER BY "id"`),
    getAllLaborRates: database.prepare(`SELECT * FROM "laborRates" ORDER BY "jobId"`),
    getQuote: database.prepare(`SELECT * FROM "quotes" WHERE "id" = ?`),
    getAllQuotes: database.prepare(`SELECT * FROM "quotes" ORDER BY "id"`),
    getQuoteLinesForQuote: database.prepare(`SELECT * FROM "quoteLines" WHERE "quoteId" = ? ORDER BY "ordering"`),
    getQuoteLinesForQuotes: database.prepare(
      `SELECT * FROM "quoteLines" WHERE "quoteId" IN (SELECT "id" FROM "quotes") ORDER BY "quoteId", "ordering"`,
    ),
    insertQuote: database.prepare(`
      INSERT INTO "quotes" ("id", "customer", "surcharge", "date")
      VALUES (?, ?, ?, ?)
      RETURNING *;
    `),
    updateQuote: database.prepare(`
      UPDATE "quotes"
      SET "customer" = ?, "surcharge" = ?, "date" = ?
      WHERE "id" = ?
      RETURNING *;
    `),
    deleteQuoteLines: database.prepare(`DELETE FROM "quoteLines" WHERE "quoteId" = ?`),
    insertQuoteLine: database.prepare(`
      INSERT INTO "quoteLines" (
        "quoteId",
        "type",
        "ordering",
        "price",
        "equipmentId",
        "laborId",
        "hours",
        "name"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `),
    deleteQuote: database.prepare(`DELETE FROM "quotes" WHERE "id" = ?`),
  }

  function getCustomerById(id: string): Customer | null {
    return (statements.getCustomer.get(id) as Customer | undefined) ?? null
  }

  function getAllCustomers(): Customer[] {
    return statements.getAllCustomers.all() as Customer[]
  }

  function persistCustomer(record: Customer): Customer {
    statements.upsertCustomer.run(
      record.id,
      record.name,
      record.address,
      record.phone,
      record.propertyType,
      record.squareFootage,
      record.systemType,
      record.systemAge,
      record.lastServiceDate,
    )

    return record
  }

  function saveCustomer(input: Partial<Customer> & Pick<Customer, "id">): Customer {
    return persistCustomer(mergeCustomer(input, getCustomerById(input.id) ?? undefined))
  }

  function createCustomer(input: Customer): Customer {
    if (getCustomerById(input.id)) {
      throw new Error(`Customer ${input.id} already exists.`)
    }

    return persistCustomer(input)
  }

  function updateCustomer(id: string, input: Partial<Customer> & Pick<Customer, "id">): Customer | null {
    const existing = getCustomerById(id)

    if (!existing) {
      return null
    }

    return persistCustomer(mergeCustomer({ ...input, id }, existing))
  }

  function deleteCustomerById(id: string): boolean {
    const result = statements.deleteCustomer.run(id)
    return Number(result.changes) > 0
  }

  function getAllEquipment(): Equipment[] {
    return statements.getAllEquipment.all() as Equipment[]
  }

  function getAllLaborRates(): LaborRate[] {
    return statements.getAllLaborRates.all() as LaborRate[]
  }

  function hydrateQuote(quote: QuoteRow): QuoteWithDetails {
    const customer = getCustomerById(quote.customer)

    if (!customer) {
      throw new Error(`Quote ${quote.id} references missing customer ${quote.customer}.`)
    }

    const lines = statements.getQuoteLinesForQuote.all(quote.id) as QuoteLine[]

    return {
      id: quote.id,
      surcharge: quote.surcharge,
      date: quote.date,
      customer,
      lines,
    }
  }

  function getQuoteById(id: number): QuoteWithDetails | null {
    const quote = (statements.getQuote.get(id) as QuoteRow | undefined) ?? null
    return quote ? hydrateQuote(quote) : null
  }

  function getAllQuotes(): QuoteWithDetails[] {
    const quotes = statements.getAllQuotes.all() as QuoteRow[]
    const customers = new Map(getAllCustomers().map((customer) => [customer.id, customer]))
    const lines = statements.getQuoteLinesForQuotes.all() as QuoteLine[]
    const linesByQuoteId = new Map<number, QuoteLine[]>()

    for (const line of lines) {
      const quoteLines = linesByQuoteId.get(line.quoteId)
      if (quoteLines) {
        quoteLines.push(line)
      } else {
        linesByQuoteId.set(line.quoteId, [line])
      }
    }

    return quotes.map((quote) => {
      const customer = customers.get(quote.customer)

      if (!customer) {
        throw new Error(`Quote ${quote.id} references missing customer ${quote.customer}.`)
      }

      return {
        id: quote.id,
        surcharge: quote.surcharge,
        date: quote.date,
        customer,
        lines: linesByQuoteId.get(quote.id) ?? [],
      }
    })
  }

  function replaceQuoteLines(quoteId: number, lines: QuoteLine[]): void {
    const seen = new Set<number>()

    for (const line of lines) {
      if (seen.has(line.ordering)) {
        throw new Error(`Quote ${quoteId} contains duplicate line ordering ${line.ordering}.`)
      }

      seen.add(line.ordering)
    }

    statements.deleteQuoteLines.run(quoteId)

    for (const line of lines) {
      statements.insertQuoteLine.run(
        line.quoteId,
        line.type,
        line.ordering,
        line.price,
        line.equipmentId,
        line.laborId,
        line.hours,
        line.name,
      )
    }
  }

  function withTransaction<T>(work: () => T): T {
    database.exec("BEGIN")

    try {
      const result = work()
      database.exec("COMMIT")
      return result
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }
  }

  function createQuote(payload: QuoteWithDetails): QuoteWithDetails {
    return withTransaction(() => {
      const customer = saveCustomer(payload.customer)
      const inserted = statements.insertQuote.get(
        payload.id ?? null,
        customer.id,
        payload.surcharge,
        payload.date,
      ) as QuoteRow

      replaceQuoteLines(inserted.id, normalizeQuoteLines(payload.lines, inserted.id))

      return hydrateQuote(inserted)
    })
  }

  function updateQuote(id: number, payload: QuoteWithDetails): QuoteWithDetails | null {
    return withTransaction(() => {
      const existing = (statements.getQuote.get(id) as QuoteRow | undefined) ?? null
      if (!existing) {
        return null
      }

      const customer = saveCustomer(payload.customer)
      const updated = statements.updateQuote.get(customer.id, payload.surcharge, payload.date, id) as QuoteRow

      replaceQuoteLines(id, normalizeQuoteLines(payload.lines, id))

      return hydrateQuote(updated)
    })
  }

  function deleteQuoteById(id: number): boolean {
    return withTransaction(() => {
      statements.deleteQuoteLines.run(id)
      const result = statements.deleteQuote.run(id)
      return Number(result.changes) > 0
    })
  }

  return {
    getCustomerById,
    getAllCustomers,
    createCustomer,
    saveCustomer,
    updateCustomer,
    deleteCustomerById,
    getAllEquipment,
    getAllLaborRates,
    getQuoteById,
    getAllQuotes,
    createQuote,
    updateQuote,
    deleteQuoteById,
  }
}

function sendNotFound(response: Response, message: string): void {
  response.status(404).json({ error: message })
}

function sendConflict(response: Response, error: unknown): void {
  response.status(409).json({
    error: error instanceof Error ? error.message : "Request conflicts with existing data.",
  })
}

export function createApp(databasePath: string) {
  const database = new DatabaseSync(databasePath)
  const db = createDatabaseHelpers(database)
  const app = express()

  app.use(express.json())

  app.get("/customers", (_request, response) => {
    response.json(db.getAllCustomers())
  })

  app.get("/customers/:id", (request, response) => {
    const customer = db.getCustomerById(request.params.id)

    if (!customer) {
      sendNotFound(response, `Customer ${request.params.id} was not found.`)
      return
    }

    response.json(customer)
  })

  app.post("/customers", (request, response) => {
    try {
      const customer = db.createCustomer(request.body as Customer)
      response.status(201).json(customer)
    } catch (error) {
      sendConflict(response, error)
    }
  })

  app.put("/customers/:id", (request, response) => {
    const customer = db.updateCustomer(request.params.id, {
      ...(request.body as Partial<Customer>),
      id: request.params.id,
    })

    if (!customer) {
      sendNotFound(response, `Customer ${request.params.id} was not found.`)
      return
    }

    response.json(customer)
  })

  app.delete("/customers/:id", (request, response) => {
    try {
      const deleted = db.deleteCustomerById(request.params.id)

      if (!deleted) {
        sendNotFound(response, `Customer ${request.params.id} was not found.`)
        return
      }

      response.status(204).send()
    } catch (error) {
      sendConflict(response, error)
    }
  })

  app.get("/equipment", (_request, response) => {
    response.json(db.getAllEquipment())
  })

  app.get("/laborRates", (_request, response) => {
    response.json(db.getAllLaborRates())
  })

  app.get("/quotes", (_request, response) => {
    try {
      response.json(db.getAllQuotes())
    } catch (error) {
      sendConflict(response, error)
    }
  })

  app.get("/quotes/:id", (request, response) => {
    const id = Number(request.params.id)

    try {
      const quote = db.getQuoteById(id)

      if (!quote) {
        sendNotFound(response, `Quote ${id} was not found.`)
        return
      }

      response.json(quote)
    } catch (error) {
      sendConflict(response, error)
    }
  })

  app.post("/quotes", (request, response) => {
    try {
      const quote = db.createQuote(request.body as QuoteWithDetails)
      response.status(201).json(quote)
    } catch (error) {
      sendConflict(response, error)
    }
  })

  app.put("/quotes/:id", (request, response) => {
    const id = Number(request.params.id)

    try {
      const quote = db.updateQuote(id, request.body as QuoteWithDetails)

      if (!quote) {
        sendNotFound(response, `Quote ${id} was not found.`)
        return
      }

      response.json(quote)
    } catch (error) {
      sendConflict(response, error)
    }
  })

  app.delete("/quotes/:id", (request, response) => {
    const id = Number(request.params.id)

    try {
      const deleted = db.deleteQuoteById(id)

      if (!deleted) {
        sendNotFound(response, `Quote ${id} was not found.`)
        return
      }

      response.status(204).send()
    } catch (error) {
      sendConflict(response, error)
    }
  })

  return { app, database }
}

function main(): void {
  const { app } = createApp(getDbPathFromArg())
  const port = Number(process.env.PORT ?? "3000")

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`)
  })
}

main()
