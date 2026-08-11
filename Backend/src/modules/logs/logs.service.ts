import { logInput } from "./logs.schema.js";
import { db } from "../../db/index.js";
import { logs } from "../../db/schema.js";
import { GetLogsQuery } from "./logs.query.schema.js";
import { and, desc, eq, gte, ilike, sql, lt } from "drizzle-orm";

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

  if (query.service) condition.push(eq(logs.service, query.service));
  if (query.level) condition.push(eq(logs.level, query.level));
  if (query.since) condition.push(gte(logs.timestamp, new Date(query.since)));
  if (query.until) condition.push(lt(logs.timestamp, new Date(query.until)));
  if (query.q) condition.push(ilike(logs.message, `%${query.q}%`));

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
