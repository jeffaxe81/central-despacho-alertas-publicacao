ALTER TABLE `alert_types` ADD `default_latitude` double DEFAULT -15.793889 NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_types` ADD `default_longitude` double DEFAULT -47.882778 NOT NULL;--> statement-breakpoint
ALTER TABLE `dispatched_alerts` ADD `latitude` double NOT NULL;--> statement-breakpoint
ALTER TABLE `dispatched_alerts` ADD `longitude` double NOT NULL;