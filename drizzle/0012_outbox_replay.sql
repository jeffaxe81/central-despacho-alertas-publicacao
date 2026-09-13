ALTER TABLE `event_outbox`
  ADD `attempts` int NOT NULL DEFAULT 0,
  ADD `next_attempt_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD `locked_until` timestamp NULL,
  ADD `locked_by` varchar(128) NULL,
  ADD `last_error` text NULL,
  ADD `delivered_at` timestamp NULL,
  ADD `dead_lettered_at` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `event_outbox_replay_idx` ON `event_outbox` (`status`,`next_attempt_at`,`locked_until`);
--> statement-breakpoint
CREATE TABLE `event_outbox_deliveries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `outbox_id` int NOT NULL,
  `subscription_id` int NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `next_attempt_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `locked_until` timestamp NULL,
  `locked_by` varchar(128) NULL,
  `last_http_status` int NULL,
  `last_error` text NULL,
  `delivered_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `event_outbox_deliveries_pk` PRIMARY KEY(`id`),
  CONSTRAINT `event_outbox_delivery_unique` UNIQUE(`outbox_id`,`subscription_id`)
);
--> statement-breakpoint
CREATE INDEX `event_outbox_delivery_replay_idx` ON `event_outbox_deliveries` (`status`,`next_attempt_at`,`locked_until`);
