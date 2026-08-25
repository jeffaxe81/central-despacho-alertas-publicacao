ALTER TABLE `alert_types` ADD `api_key` text;--> statement-breakpoint
ALTER TABLE `alert_types` ADD `api_key_header` varchar(100) DEFAULT 'x-api-key' NOT NULL;