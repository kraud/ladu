CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"granted_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_granted_by_staff_accounts_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."staff_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_active_unique" ON "user_badges" USING btree ("user_id","type") WHERE "user_badges"."revoked_at" IS NULL;