CREATE TABLE `alert_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`category` enum('iluminacao_publica','seguranca_municipal','defesa_civil','semaforos','cameras','botao_perigo') NOT NULL,
	`name` varchar(160) NOT NULL,
	`default_description` text NOT NULL,
	`default_severity` enum('baixa','media','alta','critica') NOT NULL,
	`endpoint_url` text NOT NULL,
	`headers_json` text NOT NULL,
	`auth_token` text,
	`payload_template` text NOT NULL,
	`is_test_mode` boolean NOT NULL DEFAULT true,
	`auto_enabled` boolean NOT NULL DEFAULT false,
	`auto_interval_minutes` int NOT NULL DEFAULT 15,
	`schedule_cron_task_uid` varchar(65),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_types_user_category_unique` UNIQUE(`user_id`,`category`)
);
--> statement-breakpoint
CREATE TABLE `dispatched_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`alert_type_id` int NOT NULL,
	`category` enum('iluminacao_publica','seguranca_municipal','defesa_civil','semaforos','cameras','botao_perigo') NOT NULL,
	`event_name` varchar(160) NOT NULL,
	`address` varchar(320) NOT NULL,
	`neighborhood` varchar(160) NOT NULL,
	`narrative` text NOT NULL,
	`severity` enum('baixa','media','alta','critica') NOT NULL,
	`status` enum('pendente','sucesso','falha') NOT NULL DEFAULT 'pendente',
	`endpoint_url` text NOT NULL,
	`payload_json` text NOT NULL,
	`response_http_status` int,
	`response_summary` text,
	`failure_reason` text,
	`attempt_count` int NOT NULL DEFAULT 0,
	`is_simulated` boolean NOT NULL DEFAULT true,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dispatched_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mock_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`dispatched_alert_id` int NOT NULL,
	`payload_json` text NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mock_receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `alert_types_schedule_task_idx` ON `alert_types` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `dispatched_alerts_user_sent_idx` ON `dispatched_alerts` (`user_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `dispatched_alerts_type_idx` ON `dispatched_alerts` (`alert_type_id`);--> statement-breakpoint
CREATE INDEX `dispatched_alerts_status_idx` ON `dispatched_alerts` (`status`);--> statement-breakpoint
CREATE INDEX `mock_receipts_alert_idx` ON `mock_receipts` (`dispatched_alert_id`);