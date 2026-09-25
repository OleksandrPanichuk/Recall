ALTER TABLE "question_options" DROP CONSTRAINT "question_options_legacy_unique";--> statement-breakpoint
DROP INDEX "review_states_owner_idx";--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "telegram_user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "review_states" ALTER COLUMN "telegram_user_id" SET DATA TYPE bigint;--> statement-breakpoint
CREATE INDEX "review_states_owner_due_idx" ON "review_states" USING btree ("owner_id","due_at");--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_legacy_unique" UNIQUE("question_id","legacy_id");