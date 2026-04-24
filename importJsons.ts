import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createDatabaseClient } from "./db/client.ts"
import { customers, equipment, laborRates } from "./db/schema.ts"

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

function createDeterministicUuid(seed: string): string {
  const hex = createHash("md5").update(seed).digest("hex").split("")
  hex[12] = "5"
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)

  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`
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

  const [customerData, equipmentData, laborRateData] = await Promise.all([
    readJsonFile<CustomerJson[]>("./data/customers.json"),
    readJsonFile<EquipmentJson[]>("./data/equipment.json"),
    readJsonFile<LaborRateJson[]>("./data/labor_rates.json"),
  ])

  const { client, db } = createDatabaseClient(resolve(process.cwd(), outputPath))

  try {
    db.transaction((tx) => {
      for (const customer of customerData) {
        const customerId = createDeterministicUuid(`customer:${customer.id}`)

        tx
          .insert(customers)
          .values({
            id: customerId,
            name: customer.name,
            address: customer.address,
            phone: customer.phone ?? null,
            propertyType: customer.propertyType ?? customer.property_type ?? null,
            squareFootage: customer.squareFootage ?? customer.sqft ?? null,
            systemType: customer.systemType ?? null,
            systemAge: customer.systemAge ?? null,
            lastServiceDate: customer.lastServiceDate ?? null,
          })
          .onConflictDoUpdate({
            target: customers.id,
            set: {
              name: customer.name,
              address: customer.address,
              phone: customer.phone ?? null,
              propertyType: customer.propertyType ?? customer.property_type ?? null,
              squareFootage: customer.squareFootage ?? customer.sqft ?? null,
              systemType: customer.systemType ?? null,
              systemAge: customer.systemAge ?? null,
              lastServiceDate: customer.lastServiceDate ?? null,
            },
          })
          .run()
      }

      for (const item of equipmentData) {
        tx
          .insert(equipment)
          .values({
            id: item.id,
            name: item.name,
            category: item.category,
            brand: item.brand,
            modelNumber: item.modelNumber,
            baseCost: item.baseCost ?? item.base_cost ?? 0,
          })
          .onConflictDoUpdate({
            target: equipment.id,
            set: {
              name: item.name,
              category: item.category,
              brand: item.brand,
              modelNumber: item.modelNumber,
              baseCost: item.baseCost ?? item.base_cost ?? 0,
            },
          })
          .run()
      }

      for (const rate of laborRateData) {
        const jobId = createLaborJobId(rate.jobType, rate.level)

        tx
          .insert(laborRates)
          .values({
            jobId,
            name: createLaborName(jobId),
            hourlyRate: rate.hourlyRate,
            estimatedHoursMin: rate.estimatedHours.min,
            estimatedHoursMax: rate.estimatedHours.max,
          })
          .onConflictDoUpdate({
            target: laborRates.jobId,
            set: {
              name: createLaborName(jobId),
              hourlyRate: rate.hourlyRate,
              estimatedHoursMin: rate.estimatedHours.min,
              estimatedHoursMax: rate.estimatedHours.max,
            },
          })
          .run()
      }
    })
  } finally {
    client.close()
  }
}

await main()
