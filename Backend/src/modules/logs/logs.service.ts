import { logInput } from "./logs.schema.js";
import { db } from "../../db/index.js";
import { logs } from "../../db/schema.js";
import { GetLogsQuery } from "./logs.query.schema.js";
import { and, desc, eq, gte, ilike, sql, lt, or } from "drizzle-orm";
import { decodeCursor } from "./logs.cursor.js";
import { AggLogsQuery } from "./logs.aggregate.schema.js";
export async function insertLogs(entryLogs: logInput[]) {
  if (entryLogs.length === 0) return;

  await db
    .insert(logs)
    .values(
      entryLogs.map((log) => ({
        ...log,
        timestamp: new Date(log.timestamp),
        attributes: log.attributes ?? {},
      })),
    )
    .onConflictDoNothing();
}

export async function getLogs(query: GetLogsQuery) {
  const condition = [];
  let cursor;

  if (query.service) condition.push(eq(logs.service, query.service));
  if (query.level) condition.push(eq(logs.level, query.level));
  if (query.since) condition.push(gte(logs.timestamp, new Date(query.since)));
  if (query.until) condition.push(lt(logs.timestamp, new Date(query.until)));
  if (query.q) condition.push(ilike(logs.message, `%${query.q}%`));
  if (query.cursor) {
    cursor = decodeCursor(query.cursor);

    condition.push(
      or(
        lt(logs.timestamp, new Date(cursor.timestamp)),

        and(
          eq(logs.timestamp, new Date(cursor.timestamp)),

          lt(logs.id, cursor.id),
        ),
      ),
    );
  }

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("attr.")) {
      continue;
    }

    const attributeKey = key.slice(5);

    condition.push(
      sql`${logs.attributes} ->> ${attributeKey} = ${String(value)}`,
    );
  }

  const res = await db
    .select()
    .from(logs)
    .where(condition.length > 0 ? and(...condition) : undefined)
    .orderBy(desc(logs.timestamp), desc(logs.id))
    .limit(query.limit + 1);

  return res;
}

export async function aggLogs(query: AggLogsQuery) {
  let bucket;

  switch (query.bucket) {
    case "1m":
      bucket = sql`
        date_trunc('minute', ${logs.timestamp})
      `;
      break;

    case "5m":
      bucket = sql`
        date_trunc('hour', ${logs.timestamp})
        + floor(
            extract(minute from ${logs.timestamp}) / 5
          ) * interval '5 minutes'
      `;
      break;

    case "1h":
      bucket = sql`
        date_trunc('hour', ${logs.timestamp})
      `;
      break;

    case "1d":
      bucket = sql`
        date_trunc('day', ${logs.timestamp})
      `;
      break;

    default:
      throw new Error("Unsupported bucket");
  }

}