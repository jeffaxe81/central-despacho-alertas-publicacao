CREATE TABLE `received_workflow_occurrences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`alert_type_id` int NOT NULL,
	`external_id` varchar(160) NOT NULL,
	`code` varchar(180) NOT NULL,
	`priority` varchar(24) NOT NULL,
	`status` varchar(48) NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`title` varchar(240) NOT NULL,
	`narrative` text NOT NULL,
	`address` varchar(320) NOT NULL,
	`neighborhood` varchar(160) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`payload_json` text NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `received_workflow_occurrences_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_occurrence_alert_external_unique` UNIQUE(`alert_type_id`,`external_id`)
);
--> statement-breakpoint
CREATE INDEX `workflow_occurrence_user_received_idx` ON `received_workflow_occurrences` (`user_id`,`received_at`);