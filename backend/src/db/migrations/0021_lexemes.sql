CREATE TABLE "lexemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" varchar(16) NOT NULL,
	"part_of_speech" varchar(16) NOT NULL,
	"lemma" text NOT NULL,
	"search_key" text NOT NULL,
	"forms" jsonb NOT NULL,
	"frequency_rank" integer,
	"source" varchar(32) NOT NULL,
	"licence" varchar(32) NOT NULL,
	"source_version" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lexemes_lookup_idx" ON "lexemes" USING btree ("language","part_of_speech","search_key");