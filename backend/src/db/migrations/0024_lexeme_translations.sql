CREATE TABLE "lexeme_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"english_lemma" text NOT NULL,
	"english_search_key" text NOT NULL,
	"part_of_speech" varchar(16) NOT NULL,
	"entry_order" integer DEFAULT 0 NOT NULL,
	"sense" text NOT NULL,
	"sense_order" integer NOT NULL,
	"language" varchar(16) NOT NULL,
	"word" text NOT NULL,
	"search_key" text NOT NULL,
	"gender" varchar(8),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(32) NOT NULL,
	"licence" varchar(32) NOT NULL,
	"source_version" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lexeme_translations_english_idx" ON "lexeme_translations" USING btree ("part_of_speech","english_search_key");--> statement-breakpoint
CREATE INDEX "lexeme_translations_word_idx" ON "lexeme_translations" USING btree ("language","part_of_speech","search_key");