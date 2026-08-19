import { logInput } from "./logs.schema.js";
import { db } from "../../db/index.js";
import { logs, logCounts } from "../../db/schema.js";
import { GetLogsQuery } from "./logs.query.schema.js";
import { and, desc, eq, gte, ilike, sql, lt, or } from "drizzle-orm";
import { decodeCursor } from "./logs.cursor.js";
import { AggLogsQuery } from "./logs.aggregate.schema.js";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function messageSearch(value: string) {
  return ilike(logs.message, `%${escapeLike(value)}%`);
}

const INSERT_CHUNK_SIZE = 10_000;

export type NormalizedLog = {
  timestamp: Date;
  level: string;
  service: string;
  message: string;
  attributes: Record<string, string | number | boolean>;
};

function normalizeLogs(entryLogs: logInput[]) {
  return entryLogs.map((log) => ({
    timestamp: new Date(log.timestamp),
    level: log.level,
    service: log.service,
    message: log.message,
    attributes: log.attributes ?? {},
  }));
}

export async function insertLogs(
  entryLogs: logInput[],
): Promise<NormalizedLog[]> {
  if (entryLogs.length === 0) return [];

  const rows = normalizeLogs(entryLogs);

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    await db
      .insert(logs)
      .values(rows.slice(i, i + INSERT_CHUNK_SIZE))
      .onConflictDoNothing();
  }

  return rows;
}

export type LogCountRow = {
  bucket: Date;
  service: string;
  level: string;
  count: number;
};

export function countRowsFromLogs(rows: NormalizedLog[]): LogCountRow[] {
  const counts = new Map<string, LogCountRow>();

  for (const log of rows) {
    const bucket = new Date(
      Math.floor(log.timestamp.getTime() / 60_000) * 60_000,
    );

    const key = `${bucket.toISOString()}\u0000${log.service}\u0000${log.level}`;

    const existing = counts.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        bucket,
        service: log.service,
        level: log.level,
        count: 1,
      });
    }
  }

  return [...counts.values()];
}

export async function insertLogCounts(countRows: LogCountRow[]) {
  if (countRows.length === 0) return;

  const sorted = [...countRows].sort(
    (a, b) =>
      a.bucket.getTime() - b.bucket.getTime() ||
      a.service.localeCompare(b.service) ||
      a.level.localeCompare(b.level),
  );

  for (let i = 0; i < sorted.length; i += INSERT_CHUNK_SIZE) {
    await db
      .insert(logCounts)
      .values(sorted.slice(i, i + INSERT_CHUNK_SIZE))
      .onConflictDoUpdate({
        target: [logCounts.bucket, logCounts.service, logCounts.level],
        set: { count: sql`${logCounts.count} + excluded.count` },
      });
  }
}

export async function getLogs(query: GetLogsQuery) {
  const condition = [];
  let cursor;

  if (query.service) condition.push(eq(logs.service, query.service));
  if (query.level) condition.push(eq(logs.level, query.level));
  if (query.since) condition.push(gte(logs.timestamp, new Date(query.since)));
  if (query.until) condition.push(lt(logs.timestamp, new Date(query.until)));
  if (query.q) condition.push(messageSearch(query.q));
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
  const hasRawFilters =
    query.q !== undefined ||
    Object.keys(query).some((key) => key.startsWith("attr."));

  if (hasRawFilters) {
    return aggLogsFromLogs(query);
  }

  return aggLogsFromCounts(query);
}

function bucketExpression(
  column: typeof logCounts.bucket,
  bucket: AggLogsQuery["bucket"],
) {
  switch (bucket) {
    case "1m":
      return column;

    case "5m":
      return sql`
        date_trunc('hour', ${column})
        + floor(
            extract(minute from ${column}) / 5
          ) * interval '5 minutes'
      `;

    case "1h":
      return sql`
        date_trunc('hour', ${column})
      `;

    case "1d":
      return sql`
        date_trunc('day', ${column})
      `;

    default:
      throw new Error("Unsupported bucket");
  }
}

async function aggLogsFromCounts(query: AggLogsQuery) {
  const since = new Date(query.since);
  const until = new Date(query.until);

  const sinceBucket = new Date(
    Math.floor(since.getTime() / 60_000) * 60_000,
  );

  const condition = [
    gte(logCounts.bucket, sinceBucket),
    lt(logCounts.bucket, until),
  ];

  if (query.service) condition.push(eq(logCounts.service, query.service));
  if (query.level) condition.push(eq(logCounts.level, query.level));

  const bucket = bucketExpression(logCounts.bucket, query.bucket);

  const group = query.group_by === "service" ? logCounts.service : logCounts.level;

  const rows = query.group_by
    ? await db
        .select({
          start: bucket,
          group,
          count: sql<number>`sum(${logCounts.count})::int`,
        })
        .from(logCounts)
        .where(and(...condition))
        .groupBy(bucket, group)
        .orderBy(bucket, group)
    : await db
        .select({
          start: bucket,
          group: sql<null>`null`,
          count: sql<number>`sum(${logCounts.count})::int`,
        })
        .from(logCounts)
        .where(and(...condition))
        .groupBy(bucket)
        .orderBy(bucket);

  return rows.map((row) => ({
    start:
      row.start instanceof Date
        ? row.start.toISOString().replace(".000Z", "Z")
        : new Date(String(row.start)).toISOString().replace(".000Z", "Z"),
    group: row.group,
    count: Number(row.count),
  }));
}

async function aggLogsFromLogs(query: AggLogsQuery) {
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

  const condition = [
    gte(logs.timestamp, new Date(query.since)),
    lt(logs.timestamp, new Date(query.until)),
  ];

  if (query.service) condition.push(eq(logs.service, query.service));
  if (query.level) condition.push(eq(logs.level, query.level));
  if (query.q) condition.push(messageSearch(query.q));

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("attr.")) {
      continue;
    }

    const attributeKey = key.slice(5);

    condition.push(
      sql`${logs.attributes} ->> ${attributeKey} = ${String(value)}`,
    );
  }

  const group =
    query.group_by === "service" ? logs.service : logs.level;

  const rows = query.group_by
    ? await db
        .select({
          start: bucket,
          group,
          count: sql<number>`count(*)::int`,
        })
        .from(logs)
        .where(and(...condition))
        .groupBy(bucket, group)
        .orderBy(bucket, group)
    : await db
        .select({
          start: bucket,
          group: sql<null>`null`,
          count: sql<number>`count(*)::int`,
        })
        .from(logs)
        .where(and(...condition))
        .groupBy(bucket)
        .orderBy(bucket);

  return rows.map((row) => ({
    start:
      row.start instanceof Date
        ? row.start.toISOString().replace(".000Z", "Z")
        : new Date(String(row.start)).toISOString().replace(".000Z", "Z"),
    group: row.group,
    count: Number(row.count),
  }));
}
