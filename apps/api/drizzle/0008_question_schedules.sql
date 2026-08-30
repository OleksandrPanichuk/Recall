CREATE TABLE `question_repetition_schedules` (
	`question_id` text NOT NULL,
	`telegram_user_id` integer NOT NULL,
	`repetition_count` integer NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`last_completed_at` text NOT NULL,
	`due_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`question_id`, `telegram_user_id`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_question_schedules_due` ON `question_repetition_schedules` (`telegram_user_id`,`due_at`);--> statement-breakpoint
INSERT INTO `question_repetition_schedules` (`question_id`, `telegram_user_id`, `repetition_count`, `lapses`, `last_completed_at`, `due_at`, `created_at`, `updated_at`)
SELECT q.`id`, s.`telegram_user_id`, s.`repetition_count`, 0, s.`last_completed_at`, s.`due_at`, s.`created_at`, s.`updated_at`
FROM `repetition_schedules` s
JOIN `questions` q ON q.`quiz_set_id` = s.`quiz_set_id`;
