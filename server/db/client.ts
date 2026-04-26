import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema.ts"

export function createDatabaseClient(databasePath: string) {
  const client = new Database(databasePath)
  client.pragma("foreign_keys = ON")

  return {
    client,
    db: drizzle(client, { schema }),
  }
}
