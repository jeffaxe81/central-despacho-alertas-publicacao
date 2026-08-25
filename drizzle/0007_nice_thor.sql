CREATE TABLE `general_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`default_latitude` double NOT NULL DEFAULT -15.793889,
	`default_longitude` double NOT NULL DEFAULT -47.882778,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `general_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `general_settings_user_unique` UNIQUE(`user_id`)
);
