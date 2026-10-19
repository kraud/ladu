CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "access_requests_kind_check" CHECK (kind IN ('registration', 'login'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_email_kind_unique" ON "access_requests" USING btree ("email","kind");