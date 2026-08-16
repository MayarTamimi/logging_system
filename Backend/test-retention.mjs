import postgres from "postgres";

const client = postgres("postgres://postgres:password@localhost:5433/logs");

const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const batch = 50000;

try {
  const rows = await client`
    with expired as (
      select "logs"."id"
      from "logs"
      where "logs"."timestamp" < ${cutoff}
      limit ${batch}
    )
    delete from "logs"
    using expired
    where "logs"."id" = expired.id
    returning "logs"."id"
  `;
  console.log("OK rows:", rows.length);
} catch (e) {
  console.error("ERR:", e.message);
  console.error("ERR code:", e.code);
}

await client.end();