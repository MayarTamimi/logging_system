CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logsTimestampIdIdx" ON "logs" USING btree ("timestamp","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logsServiceTimestampIdx" ON "logs" USING btree ("service","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logsLevelTimestampIdx" ON "logs" USING btree ("level","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logsMessageTrgmIdx" ON "logs" USING gin ("message" gin_trgm_ops);
