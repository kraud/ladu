ALTER TABLE "access_settings" ADD COLUMN "demo_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "access_settings" ADD COLUMN "demo_duration_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "access_settings" ADD COLUMN "demo_max_words" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "access_settings" ADD COLUMN "demo_max_tags" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo_word_limit" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo_tag_limit" integer;--> statement-breakpoint
CREATE INDEX "users_demo_expires_idx" ON "users" USING btree ("demo_expires_at") WHERE "users"."is_demo";--> statement-breakpoint
ALTER TABLE "access_settings" ADD CONSTRAINT "access_settings_demo_duration_check" CHECK (demo_duration_minutes BETWEEN 1 AND 1440);--> statement-breakpoint
ALTER TABLE "access_settings" ADD CONSTRAINT "access_settings_demo_max_words_check" CHECK (demo_max_words BETWEEN 0 AND 500);--> statement-breakpoint
ALTER TABLE "access_settings" ADD CONSTRAINT "access_settings_demo_max_tags_check" CHECK (demo_max_tags BETWEEN 0 AND 50);