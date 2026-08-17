CREATE TABLE "log_counts" (
	"bucket" timestamp with time zone NOT NULL,
	"service" varchar(100) NOT NULL,
	"level" varchar(10) NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "log_counts_bucket_service_level_pk" PRIMARY KEY("bucket","service","level")
);
--> statement-breakpoint
DROP INDEX "logsTimestamepIdx";--> statement-breakpoint
DROP INDEX "logsIdx";--> statement-breakpoint
DROP INDEX "logsMessageTrgmIdx";