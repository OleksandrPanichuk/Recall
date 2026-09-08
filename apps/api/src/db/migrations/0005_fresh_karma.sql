CREATE TABLE "page_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content_md" text,
	"author_kind" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_revisions_author_check" CHECK ("page_revisions"."author_kind" in ('user', 'mcp'))
);
--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_revisions_page_idx" ON "page_revisions" USING btree ("page_id","created_at");