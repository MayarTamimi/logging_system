import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { logs } from "./src/db/schema.js";

const client = postgres("postgres://postgres:password@localhost:5433/logs");
const db = drizzle(client);

const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const batch = 50000;

try {
  const deletedRows = await db.execute(sql`
    with expired as (
      select ${logs.id}
      from ${logs}
      where ${logs.timestamp} < ${cutoff}
      limit ${batch}
    )
    delete from ${logs}
    using expired
    where ${logs.id} = expired.id
    returning ${logs.id}
  `);
  console.log("OK rows:", deletedRows.length);
} catch (e) {
  console.error("ERR:", e.message);
  console.error("ERR code:", e.code);
}

await client.end();