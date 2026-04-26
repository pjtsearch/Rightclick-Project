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
        "date" TEXT NOT NULL,
        "accomplished" INTEGER NOT NULL DEFAULT 0
      );
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS "quoteEquipment" (
        "quoteId" TEXT NOT NULL REFERENCES "quotes"("id"),
        "equipmentId" TEXT NOT NULL REFERENCES "equipment"("id"),
        "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
        "price" REAL NOT NULL,
        PRIMARY KEY ("quoteId", "equipmentId")
      );
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS "quoteLabor" (
        "quoteId" TEXT NOT NULL REFERENCES "quotes"("id"),
        "laborId" TEXT NOT NULL REFERENCES "laborRates"("jobId"),
        "hours" REAL NOT NULL CHECK ("hours" > 0),
        "price" REAL NOT NULL,
        PRIMARY KEY ("quoteId", "laborId")
      );
    `)

    const hasQuoteLinesTable = Boolean(
      database
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'quoteLines'`)
        .get(),
    )

    if (hasQuoteLinesTable) {
      database.exec(`
        INSERT INTO "quoteEquipment" ("quoteId", "equipmentId", "quantity")
        SELECT lines."quoteId", lines."equipmentId", SUM(COALESCE(lines."quantity", 1))
        FROM "quoteLines" AS lines
        INNER JOIN "quotes" AS quotes ON quotes."id" = lines."quoteId"
        INNER JOIN "equipment" AS equipment ON equipment."id" = lines."equipmentId"
        WHERE lines."type" = 'equipment' AND lines."equipmentId" IS NOT NULL
        GROUP BY lines."quoteId", lines."equipmentId"
        ON CONFLICT("quoteId", "equipmentId") DO NOTHING;
      `)

      database.exec(`
        INSERT INTO "quoteLabor" ("quoteId", "laborId", "hours")
        SELECT lines."quoteId", lines."laborId", SUM(COALESCE(lines."hours", 0))
        FROM "quoteLines" AS lines
        INNER JOIN "quotes" AS quotes ON quotes."id" = lines."quoteId"
        INNER JOIN "laborRates" AS laborRates ON laborRates."jobId" = lines."laborId"
        WHERE lines."type" = 'labor' AND lines."laborId" IS NOT NULL
        GROUP BY lines."quoteId", lines."laborId"
        HAVING SUM(COALESCE(lines."hours", 0)) > 0
        ON CONFLICT("quoteId", "laborId") DO NOTHING;
      `)
    }
  } finally {
    database.close()
  }
}

main()
