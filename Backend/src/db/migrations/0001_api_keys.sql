CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"can_ingest" boolean DEFAULT false NOT NULL,
	"can_query" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "apiKeysKeyHashIdx" ON "api_keys" USING btree ("key_hash");
