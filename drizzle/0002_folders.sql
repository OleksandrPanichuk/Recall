CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE restrict
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_folders_parent` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `folders_parent_id_name_unique` ON `folders` (`parent_id`,`name`);--> statement-breakpoint
ALTER TABLE `quiz_sets` ADD `folder_id` text REFERENCES folders(id);