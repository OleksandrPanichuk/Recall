ALTER TABLE "study_settings" ADD COLUMN "scheduler" text DEFAULT 'ladder' NOT NULL;--> statement-breakpoint
ALTER TABLE "study_settings" ADD COLUMN "desired_retention" numeric(4, 3) DEFAULT '0.9' NOT NULL;--> statement-breakpoint
ALTER TABLE "study_settings" ADD CONSTRAINT "study_settings_scheduler_check" CHECK ("study_settings"."scheduler" in ('ladder', 'fsrs'));