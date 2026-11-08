ALTER TABLE `event_subscriptions` MODIFY COLUMN `subscriber_api_key` varchar(128);--> statement-breakpoint
ALTER TABLE `alert_types` ADD `api_key_digest` varchar(64);--> statement-breakpoint
ALTER TABLE `event_subscriptions` ADD `subscriber_key_digest` varchar(64);--> statement-breakpoint
ALTER TABLE `event_subscriptions` ADD CONSTRAINT `event_subscriptions_subscriber_digest_unique` UNIQUE(`subscriber_key_digest`);--> statement-breakpoint
CREATE INDEX `alert_types_api_key_digest_idx` ON `alert_types` (`api_key_digest`);