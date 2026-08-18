ALTER TABLE "logs" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_pkey" PRIMARY KEY("id");
