ALTER TABLE "staff_accounts" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD COLUMN "password_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;