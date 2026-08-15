-- rebuild
CREATE TABLE `__new_questions` (
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
	CONSTRAINT "questions_difficulty_check" CHECK(difficulty IN ('easy', 'medium', 'hard'))
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_questions` SELECT `id`, `quiz_set_id`, `type`, `prompt`, `explanation`, `source_reference`, `topic`, `difficulty`, `hint`, `position`, `fingerprint` FROM `questions`;
--> statement-breakpoint
DROP TABLE `questions`;
--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_quiz_set_id_position_unique` ON `questions` (`quiz_set_id`,`position`);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_quiz_set_id_fingerprint_unique` ON `questions` (`quiz_set_id`,`fingerprint`);
--> statement-breakpoint
ALTER TABLE `question_options` ADD `match_key` text;
--> statement-breakpoint
ALTER TABLE `question_responses` ADD `typed_answer` text;
