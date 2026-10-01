CREATE TABLE "login_allowed_users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_by_staff_id" uuid
);
--> statement-breakpoint
ALTER TABLE "login_allowed_users" ADD CONSTRAINT "login_allowed_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_allowed_users" ADD CONSTRAINT "login_allowed_users_added_by_staff_id_staff_accounts_id_fk" FOREIGN KEY ("added_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;