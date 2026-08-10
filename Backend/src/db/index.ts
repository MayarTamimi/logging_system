import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

console.log("DATABASE_URL =", env.DATABASE_URL);
const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, {
  schema,
});
