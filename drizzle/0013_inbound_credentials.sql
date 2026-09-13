CREATE TABLE `integration_credentials` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `tenant_id` varchar(64) NOT NULL DEFAULT 'default',
  `alert_type_id` int NOT NULL,
  `public_id` varchar(64) NOT NULL,
  `secret_hash` varchar(255) NOT NULL,
  `status` enum('active','revoked') NOT NULL DEFAULT 'active',
  `expires_at` timestamp NULL,
  `rotated_from_id` int NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` timestamp NULL,
  `last_used_at` timestamp NULL,
  CONSTRAINT `integration_credentials_pk` PRIMARY KEY(`id`),
  CONSTRAINT `integration_credentials_public_id_unique` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `integration_credentials_tenant_alert_idx` ON `integration_credentials` (`tenant_id`,`alert_type_id`);
--> statement-breakpoint
CREATE INDEX `integration_credentials_status_idx` ON `integration_credentials` (`status`,`expires_at`);
