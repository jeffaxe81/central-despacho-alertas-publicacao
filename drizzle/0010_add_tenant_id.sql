ALTER TABLE `alert_types` ADD `tenant_id` varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `dispatched_alerts` ADD `tenant_id` varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `general_settings` ADD `tenant_id` varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_receipts` ADD `tenant_id` varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `received_workflow_occurrences` ADD `tenant_id` varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tenant_id` varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_process_logs` ADD `tenant_id` varchar(64) DEFAULT 'default' NOT NULL;