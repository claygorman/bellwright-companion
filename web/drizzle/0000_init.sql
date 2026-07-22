CREATE TABLE `npc_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`guid` text NOT NULL,
	`name` text NOT NULL,
	`morale` real,
	`injuries` text NOT NULL,
	`skills` text NOT NULL,
	`equipment` text NOT NULL,
	`job_priorities` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `npc_history_guid` ON `npc_history` (`guid`);--> statement-breakpoint
CREATE INDEX `npc_history_snapshot` ON `npc_history` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ingested_at` text NOT NULL,
	`save_name` text,
	`saved_build` text,
	`region` text,
	`playtime_seconds` integer,
	`npc_count` integer NOT NULL,
	`mine_count` integer NOT NULL,
	`world` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_save_playtime` ON `snapshots` (`save_name`,`playtime_seconds`);