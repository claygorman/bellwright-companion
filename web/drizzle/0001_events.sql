CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`received_at` integer NOT NULL,
	`source` text NOT NULL,
	`level` text NOT NULL,
	`event` text NOT NULL,
	`message` text NOT NULL,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `events_received` ON `events` (`received_at`);--> statement-breakpoint
CREATE INDEX `events_source` ON `events` (`source`);