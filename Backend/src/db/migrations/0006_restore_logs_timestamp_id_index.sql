CREATE INDEX IF NOT EXISTS "logsTimestampIdIdx"
ON "logs" USING btree ("timestamp", "id");