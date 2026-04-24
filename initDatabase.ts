import { resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

function main(): void {
  const outputPath = process.argv[2]

  if (!outputPath) {
    console.error("Usage: node initDatabase.ts <output-database-file>")
    process.exit(1)
  }

  const database = new DatabaseSync(resolve(process.cwd(), outputPath))

  try {
    database.exec("PRAGMA foreign_keys = ON;")

    database.exec(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "phone" TEXT,
        "propertyType" TEXT,
        "squareFootage" INTEGER,
        "systemType" TEXT,
        "systemAge" INTEGER,
        "lastServiceDate" TEXT
      );
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS "equipment" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "brand" TEXT NOT NULL,
        "modelNumber" TEXT NOT NULL,
        "baseCost" REAL NOT NULL
      );
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS "laborRates" (
        "jobId" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "hourlyRate" REAL NOT NULL,
        "estimatedHoursMin" REAL NOT NULL,
        "estimatedHoursMax" REAL NOT NULL
      );
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS "quotes" (
        "id" TEXT PRIMARY KEY,
        "customer" TEXT NOT NULL REFERENCES "customers"("id"),
        "surcharge" REAL NOT NULL,
        "date" TEXT NOT NULL
      );
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS "quoteLines" (
        "quoteId" TEXT NOT NULL REFERENCES "quotes"("id"),
        "type" TEXT NOT NULL CHECK ("type" IN ('equipment', 'labor', 'other')),
        "ordering" INTEGER NOT NULL,
        "price" REAL NOT NULL,
        "equipmentId" TEXT REFERENCES "equipment"("id"),
        "laborId" TEXT REFERENCES "laborRates"("jobId"),
        "hours" REAL,
        "name" TEXT,
        PRIMARY KEY ("quoteId", "ordering"),
        CHECK (
          ("type" = 'equipment' AND "equipmentId" IS NOT NULL AND "laborId" IS NULL AND "hours" IS NULL AND "name" IS NULL) OR
          ("type" = 'labor' AND "equipmentId" IS NULL AND "laborId" IS NOT NULL AND "hours" IS NOT NULL AND "name" IS NULL) OR
          ("type" = 'other' AND "equipmentId" IS NULL AND "laborId" IS NULL AND "hours" IS NULL AND "name" IS NOT NULL)
        )
      );
    `)
  } finally {
    database.close()
  }
}

main()
