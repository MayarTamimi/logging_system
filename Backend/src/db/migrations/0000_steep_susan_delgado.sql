CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"level" varchar(10) NOT NULL,
	"service" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"attributes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "logsTimestamepIdx" ON "logs" USING btree ("timestamp");
CREATE INDEX "logsIdx" ON "logs" USING btree ("service","level","timestamp");