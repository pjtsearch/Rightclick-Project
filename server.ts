import express, { type Response } from "express"
import dotenv from "dotenv"
import { asc, eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { createDatabaseClient } from "./db/client.ts"
import { customers, equipment, laborRates, quoteEquipment, quoteLabor, quotes } from "./db/schema.ts"
import type { Customer, Equipment, LaborRate, QuoteWithDetails } from "./databaseTypes.ts"

dotenv.config({ path: [".env.local", ".env"] })

type AppDatabase = BetterSQLite3Database<typeof import("./db/schema.ts")>

function getDbPathFromArg(): string {
  const outputPath = process.argv[2]

  if (!outputPath) {
    console.error("Usage: node server.ts <database-file>")
    process.exit(1)
  }

  return resolve(process.cwd(), outputPath)
}

export function createDatabaseHelpers(db: AppDatabase) {
  function getCustomerByIdFrom(database: AppDatabase, id: string): Customer | null {
    const row = database.select().from(customers).where(eq(customers.id, id)).get()
    return row ?? null
  }

  function getCustomerById(id: string): Customer | null {
    return getCustomerByIdFrom(db, id)
  }

  function getAllCustomers(): Customer[] {
    return db.select().from(customers).orderBy(asc(customers.id)).all()
  }

  function upsertCustomer(database: AppDatabase, record: Customer): Customer {
    database
      .insert(customers)
      .values(record)
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: record.name,
          address: record.address,
          phone: record.phone,
          propertyType: record.propertyType,
          squareFootage: record.squareFootage,
          systemType: record.systemType,
          systemAge: record.systemAge,
          lastServiceDate: record.lastServiceDate,
        },
      })
      .run()

    return record
  }

  function createCustomer(input: Customer): Customer {
    if (getCustomerById(input.id)) {
      throw new Error(`Customer ${input.id} already exists.`)
    }

    return upsertCustomer(db, input)
  }

  function updateCustomer(id: string, input: Customer): Customer | null {
    const existing = getCustomerByIdFrom(db, id)

    if (!existing) {
      return null
    }

    return upsertCustomer(db, input)
  }

  function deleteCustomerById(id: string): boolean {
    const result = db.delete(customers).where(eq(customers.id, id)).run()
    return result.changes > 0
  }

  function getAllEquipment(): Equipment[] {
    return db.select().from(equipment).orderBy(asc(equipment.id)).all()
  }

  function getAllLaborRates(): LaborRate[] {
    return db.select().from(laborRates).orderBy(asc(laborRates.jobId)).all()
  }

  function getQuoteByIdFrom(database: AppDatabase, id: string): QuoteWithDetails | null {
    const row = database.query.quotes
      .findFirst({
        where: eq(quotes.id, id),
        with: {
          customer: true,
          equipments: {
            orderBy: (fields, { asc }) => [asc(fields.equipmentId)],
          },
          labors: {
            orderBy: (fields, { asc }) => [asc(fields.laborId)],
          },
        },
      })
      .sync()

    return row || null
  }

  function getQuoteById(id: string): QuoteWithDetails | null {
    return getQuoteByIdFrom(db, id)
  }

  function getAllQuotes(): QuoteWithDetails[] {
    return db.query.quotes
      .findMany({
        orderBy: (fields, { asc }) => [asc(fields.id)],
        with: {
          customer: true,
          equipments: {
            orderBy: (fields, { asc }) => [asc(fields.equipmentId)],
          },
          labors: {
            orderBy: (fields, { asc }) => [asc(fields.laborId)],
          },
        },
      })
      .sync()
  }

  function createQuote(payload: QuoteWithDetails): QuoteWithDetails {
    return db.transaction((tx) => {
      const transactionDb = tx as AppDatabase
      const customer = upsertCustomer(transactionDb, payload.customer)
      const quoteId = payload.id || randomUUID()
      const equipmentById = new Map(
        transactionDb
          .select()
          .from(equipment)
          .all()
          .map((item) => [item.id, item] as const),
      )
      const laborRateById = new Map(
        transactionDb
          .select()
          .from(laborRates)
          .all()
          .map((item) => [item.jobId, item] as const),
      )
      const savedRow = transactionDb
        .insert(quotes)
        .values({
          id: quoteId,
          customer: customer.id,
          surcharge: payload.surcharge,
          date: payload.date,
        })
        .returning()
        .get()

      for (const equipmentSelection of payload.equipments) {
        if (equipmentSelection.quantity <= 0) {
          continue
        }

        const equipmentItem = equipmentById.get(equipmentSelection.equipmentId)

        if (!equipmentItem) {
          throw new Error(`Equipment ${equipmentSelection.equipmentId} was not found.`)
        }

        tx.insert(quoteEquipment)
          .values({
            quoteId: savedRow.id,
            equipmentId: equipmentSelection.equipmentId,
            quantity: equipmentSelection.quantity,
            price: equipmentItem.baseCost,
          })
          .run()
      }

      for (const laborSelection of payload.labors) {
        if (laborSelection.hours <= 0) {
          continue
        }

        const laborRateItem = laborRateById.get(laborSelection.laborId)

        if (!laborRateItem) {
          throw new Error(`Labor rate ${laborSelection.laborId} was not found.`)
        }

        tx.insert(quoteLabor)
          .values({
            quoteId: savedRow.id,
            laborId: laborSelection.laborId,
            hours: laborSelection.hours,
            price: laborRateItem.hourlyRate,
          })
          .run()
      }

      const quote = getQuoteByIdFrom(transactionDb, savedRow.id)

      if (!quote) {
        throw new Error(`Quote ${savedRow.id} could not be loaded after creation.`)
      }

      return quote
    })
  }

  function deleteQuoteById(id: string): boolean {
    return db.transaction((tx) => {
      tx.delete(quoteEquipment).where(eq(quoteEquipment.quoteId, id)).run()
      tx.delete(quoteLabor).where(eq(quoteLabor.quoteId, id)).run()
      const result = tx.delete(quotes).where(eq(quotes.id, id)).run()
      return result.changes > 0
    })
  }

  return {
    getCustomerById,
    getAllCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomerById,
    getAllEquipment,
    getAllLaborRates,
    getQuoteById,
    getAllQuotes,
    createQuote,
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
  const { client, db } = createDatabaseClient(databasePath)
  const helpers = createDatabaseHelpers(db)
  const app = express()
  const api = express.Router()
  const clientDistPath = resolve(process.cwd(), "client/dist")

  app.use(express.json())
  app.use("/api", api)

  api.get("/customers", (_request, response) => {
    response.json(helpers.getAllCustomers())
  })

  api.get("/customers/:id", (request, response) => {
    const customer = helpers.getCustomerById(request.params.id)

    if (!customer) {
      sendNotFound(response, `Customer ${request.params.id} was not found.`)
      return
    }

    response.json(customer)
  })

  api.post("/customers", (request, response) => {
    try {
      const customer = helpers.createCustomer(request.body as Customer)
      response.status(201).json(customer)
    } catch (error) {
      sendConflict(response, error)
    }
  })

  api.put("/customers/:id", (request, response) => {
    const customer = helpers.updateCustomer(request.params.id, request.body as Customer)

    if (!customer) {
      sendNotFound(response, `Customer ${request.params.id} was not found.`)
      return
    }

    response.json(customer)
  })

  api.delete("/customers/:id", (request, response) => {
    try {
      const deleted = helpers.deleteCustomerById(request.params.id)

      if (!deleted) {
        sendNotFound(response, `Customer ${request.params.id} was not found.`)
        return
      }

      response.status(204).send()
    } catch (error) {
      sendConflict(response, error)
    }
  })

  api.get("/equipment", (_request, response) => {
    response.json(helpers.getAllEquipment())
  })

  api.get("/laborRates", (_request, response) => {
    response.json(helpers.getAllLaborRates())
  })

  api.get("/quotes", (_request, response) => {
    try {
      response.json(helpers.getAllQuotes())
    } catch (error) {
      sendConflict(response, error)
    }
  })

  api.get("/quotes/:id", (request, response) => {
    const id = request.params.id

    try {
      const quote = helpers.getQuoteById(id)

      if (!quote) {
        sendNotFound(response, `Quote ${id} was not found.`)
        return
      }

      response.json(quote)
    } catch (error) {
      sendConflict(response, error)
    }
  })

  api.post("/quotes", (request, response) => {
    try {
      const quote = helpers.createQuote(request.body as QuoteWithDetails)
      response.status(201).json(quote)
    } catch (error) {
      sendConflict(response, error)
    }
  })

  api.post("/realtime/client-secret", async (_request, response) => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      response.status(500).json({
        error: "OPENAI_API_KEY must be set.",
      })
      return
    }

    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: "gpt-realtime",
            audio: {
              output: {
                voice: "marin",
              },
            },
          },
        }),
      })

      const payload = (await openaiResponse.json()) as unknown

      if (!openaiResponse.ok) {
        response.status(openaiResponse.status).json(payload)
        return
      }

      response.json(payload)
    } catch (error) {
      response.status(500).json({
        error: error instanceof Error ? error.message : "Unable to create realtime client secret.",
      })
    }
  })

  api.delete("/quotes/:id", (request, response) => {
    const id = request.params.id

    try {
      const deleted = helpers.deleteQuoteById(id)

      if (!deleted) {
        sendNotFound(response, `Quote ${id} was not found.`)
        return
      }

      response.status(204).send()
    } catch (error) {
      sendConflict(response, error)
    }
  })

  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath))
    app.get(/.*/, (_request, response) => {
      response.sendFile(resolve(clientDistPath, "index.html"))
    })
  }

  return { app, client }
}

function main(): void {
  const { app } = createApp(getDbPathFromArg())
  const port = Number(process.env.PORT ?? "3000")

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`)
  })
}

const isMainModule =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main()
}
