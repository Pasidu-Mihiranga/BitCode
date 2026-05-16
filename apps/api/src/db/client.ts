/**
 * Postgres + Drizzle client. One pool per process; transaction-aware so the
 * audit hash chain and the business mutation commit atomically (NFR-07).
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://swiftdrop:swiftdrop@localhost:5432/swiftdrop";

// Generous pool — purchase endpoint will burst under k6.
export const sqlClient = postgres(connectionString, {
  max: 32,
  idle_timeout: 30,
  prepare: false,
  onnotice: () => {},
});

export const db: PostgresJsDatabase<typeof schema> = drizzle(sqlClient, {
  schema,
  logger: false,
});

export type DbClient = typeof db;
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export { schema };
