DROP INDEX "lexemes_lookup_idx";--> statement-breakpoint
CREATE INDEX "lexemes_lookup_idx" ON "lexemes" USING btree ("language","part_of_speech","search_key" text_pattern_ops);