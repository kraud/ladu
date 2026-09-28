ALTER TABLE "tags" ADD COLUMN "source_tag_id" uuid;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "source_word_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_source_tag_id_tags_id_fk" FOREIGN KEY ("source_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_source_word_id_words_id_fk" FOREIGN KEY ("source_word_id") REFERENCES "public"."words"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tag_words_word_id_idx" ON "tag_words" USING btree ("word_id");--> statement-breakpoint
CREATE INDEX "tags_author_id_idx" ON "tags" USING btree ("author_id");--> statement-breakpoint
-- Data fix (phase-4-tags.md D13 / Slice 1): rename pre-existing duplicate
-- (author_id, lower(label)) tags before the unique index below is added, so
-- this migration does not fail against seeded/staging data that predates
-- the uniqueness rule. Within each duplicate group the oldest tag
-- (by created_at, then id) keeps its label; every later one gets a numeric
-- suffix ("Label" -> "Label (2)", "Label (3)", ...). This does not guard
-- against a suffixed name colliding with some other, unrelated tag that
-- already happens to have that exact label -- verify against a copy of real
-- data before this migration runs past local dev (see phase-4-tags.md
-- "Risks: Migration on real data").
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT id, label || ' (' || rn || ')' AS new_label
    FROM (
      SELECT id, label,
             row_number() OVER (
               PARTITION BY author_id, lower(label)
               ORDER BY created_at, id
             ) AS rn
      FROM tags
    ) ranked
    WHERE rn > 1
  LOOP
    UPDATE tags SET label = dup.new_label WHERE id = dup.id;
  END LOOP;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_author_label_unique" ON "tags" USING btree ("author_id",lower("label"));--> statement-breakpoint
CREATE INDEX "user_following_tags_follower_user_id_idx" ON "user_following_tags" USING btree ("follower_user_id");