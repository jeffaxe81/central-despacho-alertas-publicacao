CREATE TABLE `event_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`correlation_id` varchar(160) NOT NULL,
	`event_id` varchar(160) NOT NULL,
	`category` varchar(64) NOT NULL,
	`connector_id` varchar(64),
	`payload_json` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'pending',
	`delivered_count` int NOT NULL DEFAULT 0,
	`failed_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_outbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`label` varchar(160) NOT NULL,
	`category` varchar(64),
	`delivery_mode` varchar(16) NOT NULL,
	`endpoint_url` varchar(2000),
	`headers_json` text DEFAULT ('{}'),
	`outbound_api_key_header` varchar(100) DEFAULT 'X-ALRT-API-Key',
	`outbound_api_key` varchar(4000),
	`subscriber_api_key` varchar(128) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_subscriptions_subscriber_key_unique` UNIQUE(`subscriber_api_key`)
);
--> statement-breakpoint
CREATE INDEX `event_outbox_tenant_category_idx` ON `event_outbox` (`tenant_id`,`category`);--> statement-breakpoint
CREATE INDEX `event_outbox_correlation_idx` ON `event_outbox` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `event_subscriptions_tenant_category_idx` ON `event_subscriptions` (`tenant_id`,`category`);