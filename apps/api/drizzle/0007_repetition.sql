CREATE TABLE `repetition_defaults` (
	`id` integer PRIMARY KEY NOT NULL,
	`intervals_days` text NOT NULL,
	`max_interval_days` integer NOT NULL,
	`max_repetitions` integer NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "repetition_defaults_single_row" CHECK("repetition_defaults"."id" = 1)
) STRICT;
--> statement-breakpoint
CREATE TABLE `repetition_schedules` (
	`quiz_set_id` text NOT NULL,
	`telegram_user_id` integer NOT NULL,
	`repetition_count` integer NOT NULL,
	`last_completed_at` text NOT NULL,
	`due_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`quiz_set_id`, `telegram_user_id`),
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE cascade
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_repetition_schedules_due` ON `repetition_schedules` (`telegram_user_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `repetition_settings` (
	`quiz_set_id` text PRIMARY KEY NOT NULL,
	`intervals_days` text NOT NULL,
	`max_interval_days` integer NOT NULL,
	`max_repetitions` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE cascade
) STRICT;
