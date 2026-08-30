CREATE TABLE `question_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`text` text NOT NULL,
	`is_correct` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "question_options_is_correct_check" CHECK(is_correct IN (0, 1))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `question_options_question_id_position_unique` ON `question_options` (`question_id`,`position`);--> statement-breakpoint
CREATE TABLE `question_responses` (
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_option_ids` text NOT NULL,
	`is_correct` integer NOT NULL,
	`answered_at` text NOT NULL,
	PRIMARY KEY(`attempt_id`, `question_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "question_responses_is_correct_check" CHECK(is_correct IN (0, 1))
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_question_responses_question` ON `question_responses` (`question_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_set_id` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`explanation` text,
	`source_reference` text,
	`topic` text,
	`difficulty` text NOT NULL,
	`hint` text,
	`position` integer NOT NULL,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "questions_type_check" CHECK(type IN ('single_choice', 'multiple_choice', 'true_false')),
	CONSTRAINT "questions_difficulty_check" CHECK(difficulty IN ('easy', 'medium', 'hard'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_quiz_set_id_position_unique` ON `questions` (`quiz_set_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_quiz_set_id_fingerprint_unique` ON `questions` (`quiz_set_id`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_set_id` text NOT NULL,
	`telegram_user_id` integer NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`question_ids` text NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "quiz_attempts_mode_check" CHECK(mode IN ('full', 'mistakes', 'weak_topics')),
	CONSTRAINT "quiz_attempts_status_check" CHECK(status IN ('active', 'paused', 'completed'))
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_quiz_attempts_user_status` ON `quiz_attempts` (`telegram_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `quiz_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`language` text NOT NULL,
	`source` text,
	`source_chapters` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`archived_at` text,
	CONSTRAINT "quiz_sets_status_check" CHECK(status IN ('draft', 'published', 'archived'))
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_quiz_sets_status` ON `quiz_sets` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`telegram_user_id` integer NOT NULL,
	`state` text NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_reviewed_at` text,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_items_state_check" CHECK(state IN ('pending', 'learning', 'retired')),
	CONSTRAINT "review_items_streak_check" CHECK(streak >= 0)
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_review_items_due` ON `review_items` (`telegram_user_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_review_items_question` ON `review_items` (`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_items_telegram_user_id_question_id_unique` ON `review_items` (`telegram_user_id`,`question_id`);