-- Data fix (phase-5-practice.md B.3 "Migration 0007" / D5): clean the performance
-- tables before the constraints below are added, so this migration does not
-- fail on existing data. It DELETES rows; the counts are logged as NOTICEs.
--   1. Orphans: rows whose translation was removed (FK was "set null").
--   2. Duplicates per (user_id, translation_id): keep the row with the latest
--      last_date_modified_translation (then latest created_at, then id).
--      Their case stats are removed by the FK cascade.
--   3. Duplicates per (exercise_performance_id, case_name): keep the latest
--      last_date (NULLs last, then id).
--   4. Unknown modifier values are cleared to NULL (the CHECK below).
DO $$
DECLARE
  n_orphans integer;
  n_dup_perf integer;
  n_dup_case integer;
  n_modifier integer;
BEGIN
  DELETE FROM exercise_performances WHERE translation_id IS NULL;
  GET DIAGNOSTICS n_orphans = ROW_COUNT;

  DELETE FROM exercise_performances
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             row_number() OVER (
               PARTITION BY user_id, translation_id
               ORDER BY last_date_modified_translation DESC NULLS LAST, created_at DESC, id DESC
             ) AS rn
      FROM exercise_performances
    ) ranked
    WHERE rn > 1
  );
  GET DIAGNOSTICS n_dup_perf = ROW_COUNT;

  DELETE FROM exercise_performance_cases
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             row_number() OVER (
               PARTITION BY exercise_performance_id, case_name
               ORDER BY last_date DESC NULLS LAST, id DESC
             ) AS rn
      FROM exercise_performance_cases
    ) ranked
    WHERE rn > 1
  );
  GET DIAGNOSTICS n_dup_case = ROW_COUNT;

  UPDATE exercise_performances SET performance_modifier = NULL
  WHERE performance_modifier IS NOT NULL AND performance_modifier NOT IN ('Mastered', 'Revise');
  GET DIAGNOSTICS n_modifier = ROW_COUNT;

  RAISE NOTICE 'migration 0007: deleted % orphan performances, % duplicate performances, % duplicate case stats; cleared % invalid modifiers',
    n_orphans, n_dup_perf, n_dup_case, n_modifier;
END $$;--> statement-breakpoint
ALTER TABLE "exercise_performances" DROP CONSTRAINT "exercise_performances_translation_id_translations_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_performances" ALTER COLUMN "translation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD CONSTRAINT "exercise_performances_translation_id_translations_id_fk" FOREIGN KEY ("translation_id") REFERENCES "public"."translations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "epc_performance_case_unique" ON "exercise_performance_cases" USING btree ("exercise_performance_id","case_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ep_user_translation_unique" ON "exercise_performances" USING btree ("user_id","translation_id");--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD CONSTRAINT "ep_modifier_check" CHECK ("exercise_performances"."performance_modifier" IN ('Mastered', 'Revise'));