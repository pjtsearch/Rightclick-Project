import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

type CustomerJson = {
  id: string
  name: string
  address: string
  phone?: string
  propertyType?: string
  property_type?: string
  squareFootage?: number
  sqft?: number
  systemType?: string
  systemAge?: number
  lastServiceDate?: string
}

type EquipmentJson = {
  id: string
  name: string
  category: string
  brand: string
  modelNumber: string
  baseCost?: number
  base_cost?: number
}

type LaborRateJson = {
  jobType: string
  level: string
  hourlyRate: number
  estimatedHours: {
    min: number
    max: number
  }
}

function createLaborJobId(jobType: string, level: string): string {
  return `${level}-${jobType}`.toLowerCase()
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function createLaborName(jobId: string): string {
  return titleCase(jobId.replace(/-/g, " "))
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8")) as T
}

async function main(): Promise<void> {
  const outputPath = process.argv[2]

  if (!outputPath) {
    console.error("Usage: node importJsons.ts <output-database-file>")
    process.exit(1)
  }

  const [customers, equipment, laborRates] = await Promise.all([
    readJsonFile<CustomerJson[]>("./data/customers.json"),
    readJsonFile<EquipmentJson[]>("./data/equipment.json"),
    readJsonFile<LaborRateJson[]>("./data/labor_rates.json"),
  ])

  const database = new DatabaseSync(resolve(process.cwd(), outputPath))

  try {
    database.exec("PRAGMA foreign_keys = ON;")
    database.exec("BEGIN TRANSACTION;")

    const insertCustomer = database.prepare(`
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
    `)

    const insertEquipment = database.prepare(`
      INSERT INTO "equipment" (
        "id",
        "name",
        "category",
        "brand",
        "modelNumber",
        "baseCost"
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT("id") DO UPDATE SET
        "name" = excluded."name",
        "category" = excluded."category",
        "brand" = excluded."brand",
        "modelNumber" = excluded."modelNumber",
        "baseCost" = excluded."baseCost";
    `)

    const insertLaborRate = database.prepare(`
      INSERT INTO "laborRates" (
        "jobId",
        "name",
        "hourlyRate",
        "estimatedHoursMin",
        "estimatedHoursMax"
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT("jobId") DO UPDATE SET
        "name" = excluded."name",
        "hourlyRate" = excluded."hourlyRate",
        "estimatedHoursMin" = excluded."estimatedHoursMin",
        "estimatedHoursMax" = excluded."estimatedHoursMax";
    `)

    for (const customer of customers) {
      insertCustomer.run(
        customer.id,
        customer.name,
        customer.address,
        customer.phone ?? null,
        customer.propertyType ?? customer.property_type ?? null,
        customer.squareFootage ?? customer.sqft ?? null,
        customer.systemType ?? null,
        customer.systemAge ?? null,
        customer.lastServiceDate ?? null,
      )
    }

    for (const item of equipment) {
      insertEquipment.run(
        item.id,
        item.name,
        item.category,
        item.brand,
        item.modelNumber,
        item.baseCost ?? item.base_cost!,
      )
    }

    for (const rate of laborRates) {
      const jobId = createLaborJobId(rate.jobType, rate.level)

      insertLaborRate.run(
        jobId,
        createLaborName(jobId),
        rate.hourlyRate,
        rate.estimatedHours.min,
        rate.estimatedHours.max,
      )
    }

    database.exec("COMMIT;")
  } catch (error) {
    database.exec("ROLLBACK;")
    throw error
  } finally {
    database.close()
  }
}

await main()
