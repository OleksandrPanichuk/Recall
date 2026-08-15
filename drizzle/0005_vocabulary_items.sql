CREATE TABLE `vocabulary_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_set_id` text NOT NULL,
	`terms` text NOT NULL,
	`translations` text NOT NULL,
	`transcription` text,
	`example` text,
	`topic` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`quiz_set_id`) REFERENCES `quiz_sets`(`id`) ON UPDATE no action ON DELETE cascade
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_vocabulary_items_set` ON `vocabulary_items` (`quiz_set_id`);--> statement-breakpoint
ALTER TABLE `questions` ADD `vocabulary_item_id` text;