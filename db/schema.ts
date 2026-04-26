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
  accomplished: integer("accomplished", { mode: "boolean" }).notNull().default(false),
})

export const quoteEquipment = sqliteTable(
  "quoteEquipment",
  {
    quoteId: text("quoteId").notNull().references(() => quotes.id),
    equipmentId: text("equipmentId").notNull().references(() => equipment.id),
    quantity: integer("quantity").notNull(),
    price: real("price").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.quoteId, table.equipmentId] }),
    check("quote_equipment_quantity_check", sql`${table.quantity} > 0`),
  ],
)

export const quoteLabor = sqliteTable(
  "quoteLabor",
  {
    quoteId: text("quoteId").notNull().references(() => quotes.id),
    laborId: text("laborId").notNull().references(() => laborRates.jobId),
    hours: real("hours").notNull(),
    price: real("price").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.quoteId, table.laborId] }),
    check("quote_labor_hours_check", sql`${table.hours} > 0`),
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
  equipments: many(quoteEquipment),
  labors: many(quoteLabor),
}))

export const quoteEquipmentRelations = relations(quoteEquipment, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteEquipment.quoteId],
    references: [quotes.id],
  }),
  equipment: one(equipment, {
    fields: [quoteEquipment.equipmentId],
    references: [equipment.id],
  }),
}))

export const quoteLaborRelations = relations(quoteLabor, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteLabor.quoteId],
    references: [quotes.id],
  }),
  laborRate: one(laborRates, {
    fields: [quoteLabor.laborId],
    references: [laborRates.jobId],
  }),
}))
