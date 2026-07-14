CREATE TABLE `account_document_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`responsible_name` text,
	`responsible_type` text,
	`onboarding_url` text,
	`onboarding_url_expiration_date` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_document_groups_account_idx` ON `account_document_groups` (`account_id`);--> statement-breakpoint
CREATE TABLE `account_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`account_id` text NOT NULL,
	`status` text NOT NULL,
	`file_name` text,
	`sent_at` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `account_document_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_documents_group_idx` ON `account_documents` (`group_id`);