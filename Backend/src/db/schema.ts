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
} from "drizzle-orm/pg-core";

export const logs = pgTable(
  "logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    index("logsTimestamepIdx").on(t.timestamp),

    index("logsIdx").on( // index on level, service, timestamp
      t.service,
      t.level,
      t.timestamp,
    ),
  ],
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

