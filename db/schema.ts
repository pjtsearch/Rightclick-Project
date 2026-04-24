import { relations, sql } from "drizzle-orm"
import { check, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  propertyType: text("propertyType"),
  squareFootage: integer("squareFootage"),
  systemType: text("systemType"),
  systemAge: integer("systemAge"),
  lastServiceDate: text("lastServiceDate"),
})

export const equipment = sqliteTable("equipment", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  brand: text("brand").notNull(),
  modelNumber: text("modelNumber").notNull(),
  baseCost: real("baseCost").notNull(),
})

export const laborRates = sqliteTable("laborRates", {
  jobId: text("jobId").primaryKey(),
  name: text("name").notNull(),
  hourlyRate: real("hourlyRate").notNull(),
  estimatedHoursMin: real("estimatedHoursMin").notNull(),
  estimatedHoursMax: real("estimatedHoursMax").notNull(),
})

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  customer: text("customer").notNull().references(() => customers.id),
  surcharge: real("surcharge").notNull(),
  date: text("date").notNull(),
})

export const quoteLines = sqliteTable(
  "quoteLines",
  {
    quoteId: text("quoteId").notNull().references(() => quotes.id),
    type: text("type", { enum: ["equipment", "labor", "other"] }).notNull(),
    ordering: integer("ordering").notNull(),
    price: real("price").notNull(),
    equipmentId: text("equipmentId").references(() => equipment.id),
    laborId: text("laborId").references(() => laborRates.jobId),
    hours: real("hours"),
    name: text("name"),
  },
  (table) => [
    primaryKey({ columns: [table.quoteId, table.ordering] }),
    check(
      "quote_lines_type_check",
      sql`(
        (${table.type} = 'equipment' AND ${table.equipmentId} IS NOT NULL AND ${table.laborId} IS NULL AND ${table.hours} IS NULL AND ${table.name} IS NULL) OR
        (${table.type} = 'labor' AND ${table.equipmentId} IS NULL AND ${table.laborId} IS NOT NULL AND ${table.hours} IS NOT NULL AND ${table.name} IS NULL) OR
        (${table.type} = 'other' AND ${table.equipmentId} IS NULL AND ${table.laborId} IS NULL AND ${table.hours} IS NULL AND ${table.name} IS NOT NULL)
      )`,
    ),
  ],
)

export const customersRelations = relations(customers, ({ many }) => ({
  quotes: many(quotes),
}))

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotes.customer],
    references: [customers.id],
  }),
  lines: many(quoteLines),
}))

export const quoteLinesRelations = relations(quoteLines, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteLines.quoteId],
    references: [quotes.id],
  }),
}))
