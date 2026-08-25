ALTER TABLE "attempts" DROP CONSTRAINT "attempts_legacy_unique";--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_legacy_unique";--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_parent_slug_unique";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_legacy_unique";--> statement-breakpoint
ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_legacy_unique";--> statement-breakpoint
ALTER TABLE "study_settings" DROP CONSTRAINT "study_settings_scope_unique";--> statement-breakpoint
ALTER TABLE "term_pairs" DROP CONSTRAINT "term_pairs_legacy_unique";--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "review_states" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "study_settings" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "term_pairs" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_states" ADD CONSTRAINT "review_states_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_settings" ADD CONSTRAINT "study_settings_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_pairs" ADD CONSTRAINT "term_pairs_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_owner_idx" ON "attempts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "pages_owner_idx" ON "pages" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "questions_owner_idx" ON "questions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "quizzes_owner_idx" ON "quizzes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "study_settings_owner_idx" ON "study_settings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "review_states_owner_idx" ON "study_settings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "term_pairs_owner_idx" ON "term_pairs" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_legacy_unique" UNIQUE("owner_id","legacy_id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_legacy_unique" UNIQUE("owner_id","legacy_id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_slug_unique" UNIQUE NULLS NOT DISTINCT("owner_id","parent_id","slug");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_legacy_unique" UNIQUE("owner_id","legacy_id");--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_legacy_unique" UNIQUE("owner_id","legacy_id");--> statement-breakpoint
ALTER TABLE "study_settings" ADD CONSTRAINT "study_settings_scope_unique" UNIQUE NULLS NOT DISTINCT("owner_id","scope_type","scope_id");--> statement-breakpoint
ALTER TABLE "term_pairs" ADD CONSTRAINT "term_pairs_legacy_unique" UNIQUE("owner_id","legacy_id");
--> statement-breakpoint
DO $$
DECLARE
	sole_owner text;
	orphaned bigint;
BEGIN
	SELECT id INTO sole_owner FROM "user" ORDER BY created_at LIMIT 1;

	IF sole_owner IS NOT NULL THEN
		UPDATE "attempts" SET "owner_id" = sole_owner WHERE "owner_id" IS NULL;
		UPDATE "pages" SET "owner_id" = sole_owner WHERE "owner_id" IS NULL;
		UPDATE "questions" SET "owner_id" = sole_owner WHERE "owner_id" IS NULL;
		UPDATE "quizzes" SET "owner_id" = sole_owner WHERE "owner_id" IS NULL;
		UPDATE "review_states" SET "owner_id" = sole_owner WHERE "owner_id" IS NULL;
		UPDATE "study_settings" SET "owner_id" = sole_owner WHERE "owner_id" IS NULL;
		UPDATE "term_pairs" SET "owner_id" = sole_owner WHERE "owner_id" IS NULL;
	END IF;

	SELECT (SELECT count(*) FROM "attempts" WHERE "owner_id" IS NULL) + (SELECT count(*) FROM "pages" WHERE "owner_id" IS NULL) + (SELECT count(*) FROM "questions" WHERE "owner_id" IS NULL) + (SELECT count(*) FROM "quizzes" WHERE "owner_id" IS NULL) + (SELECT count(*) FROM "review_states" WHERE "owner_id" IS NULL) + (SELECT count(*) FROM "study_settings" WHERE "owner_id" IS NULL) + (SELECT count(*) FROM "term_pairs" WHERE "owner_id" IS NULL) INTO orphaned;

	IF orphaned > 0 THEN
		RAISE EXCEPTION 'ownership migration found % row(s) with no owner and no user to adopt them. Link the owner through the bot first, or re-run the etl into an empty database.', orphaned;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quizzes" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "review_states" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "study_settings" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "term_pairs" ALTER COLUMN "owner_id" SET NOT NULL;
