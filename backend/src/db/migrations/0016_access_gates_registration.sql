CREATE TABLE "access_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"registration_mode" varchar(16) DEFAULT 'open' NOT NULL,
	"registration_note" varchar(300) DEFAULT '' NOT NULL,
	"login_mode" varchar(16) DEFAULT 'open' NOT NULL,
	"login_note" varchar(300) DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_staff_id" uuid,
	CONSTRAINT "access_settings_single_row" CHECK (id = 1),
	CONSTRAINT "access_settings_registration_mode_check" CHECK (registration_mode IN ('open', 'closed', 'limited')),
	CONSTRAINT "access_settings_login_mode_check" CHECK (login_mode IN ('open', 'closed', 'limited'))
);
--> statement-breakpoint
CREATE TABLE "registration_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_staff_id" uuid,
	CONSTRAINT "registration_invites_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "access_settings" ADD CONSTRAINT "access_settings_updated_by_staff_id_staff_accounts_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_invites" ADD CONSTRAINT "registration_invites_created_by_staff_id_staff_accounts_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- The single settings row. Both gates start open, so a deploy changes nothing.
INSERT INTO "access_settings" ("id") VALUES (1);
