CREATE TABLE `workflow_process_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`alert_type_id` int,
	`external_id` varchar(160),
	`outcome` varchar(24) NOT NULL,
	`http_status` int NOT NULL,
	`reason` text,
	`payload_json` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_process_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `workflow_process_logs_alert_created_idx` ON `workflow_process_logs` (`alert_type_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `workflow_process_logs_external_idx` ON `workflow_process_logs` (`external_id`);