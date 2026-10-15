CREATE TABLE "demo_refusals" (
	"day" date NOT NULL,
	"code" varchar(32) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "demo_refusals_day_code_pk" PRIMARY KEY("day","code")
);
--> statement-breakpoint
CREATE TABLE "demo_starts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"started_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ui_language" varchar(50) NOT NULL,
	"languages" text[] NOT NULL,
	"seed_words" integer NOT NULL,
	"seed_tags" integer NOT NULL,
	"seed_configs" integer NOT NULL,
	"word_limit" integer NOT NULL,
	"tag_limit" integer NOT NULL,
	"words_added" integer,
	"tags_added" integer,
	"configs_added" integer,
	"translations_practised" integer,
	"closed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "demo_starts" ADD CONSTRAINT "demo_starts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demo_starts_started_idx" ON "demo_starts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "demo_starts_user_idx" ON "demo_starts" USING btree ("user_id");