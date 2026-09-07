CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tag_share_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."tag_visibility" AS ENUM('Public', 'Private', 'Friends-Only');--> statement-breakpoint
CREATE TABLE "tag_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"status" "tag_share_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friendship_partnerships" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "friendship_partnerships" CASCADE;--> statement-breakpoint
ALTER TABLE "tags" RENAME COLUMN "public" TO "visibility";--> statement-breakpoint
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_user1_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_user2_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "friendships" ALTER COLUMN "status" SET DATA TYPE "public"."friendship_status" USING "status"::"public"."friendship_status";--> statement-breakpoint
ALTER TABLE "friendships" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "friendships" ADD COLUMN "requester_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "friendships" ADD COLUMN "addressee_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "tag_shares" ADD CONSTRAINT "tag_shares_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_shares" ADD CONSTRAINT "tag_shares_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_shares" ADD CONSTRAINT "tag_shares_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tag_shares_pending_unique" ON "tag_shares" USING btree ("tag_id","recipient_id") WHERE "tag_shares"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pending_unique" ON "friendships" USING btree ("requester_id","addressee_id") WHERE "friendships"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_accepted_unique" ON "friendships" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id")) WHERE "friendships"."status" = 'accepted';--> statement-breakpoint
ALTER TABLE "friendships" DROP COLUMN "user1_id";--> statement-breakpoint
ALTER TABLE "friendships" DROP COLUMN "user2_id";