CREATE TABLE "page_shares" (
	"owner_id" text NOT NULL,
	"page_id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_visibility_check";--> statement-breakpoint
ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_visibility_check";--> statement-breakpoint
ALTER TABLE "page_shares" ADD CONSTRAINT "page_shares_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_shares" ADD CONSTRAINT "page_shares_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_shares_owner_idx" ON "page_shares" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "quizzes" DROP COLUMN "visibility";