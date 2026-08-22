import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
  bigint,
} from "drizzle-orm/pg-core";

export const logs = pgTable(
  "logs",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    level: varchar("level", { length: 10 }).notNull(),
    service: varchar("service", { length: 100 }).notNull(),
    message: text("message").notNull(),
    attributes: jsonb("attributes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
(t) => [
    index("logsServiceTimestampIdx").on(t.service, t.timestamp),
    index("logsTimestampIdIdx").on(t.timestamp, t.id),
  ],
);

export const logCounts = pgTable(
  "log_counts",
  {
    bucket: timestamp("bucket", { withTimezone: true }).notNull(),
    service: varchar("service", { length: 100 }).notNull(),
    level: varchar("level", { length: 10 }).notNull(),
    count: bigint("count", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.service, t.level] })],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    canIngest: boolean("can_ingest").default(false).notNull(),
    canQuery: boolean("can_query").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("apiKeysKeyHashIdx").on(t.keyHash)],
);

