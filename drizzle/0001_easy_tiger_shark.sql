CREATE TABLE `one_voice_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slot_kst` text NOT NULL,
	`captured_at` text NOT NULL,
	`test_drive_score` real NOT NULL,
	`car_handover_score` real NOT NULL,
	`source` text DEFAULT 'medallia-market-admin' NOT NULL,
	`period` text DEFAULT 'last-6-months-to-date' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_voice_snapshots_slot_kst_unique` ON `one_voice_snapshots` (`slot_kst`);--> statement-breakpoint
CREATE TABLE `one_voice_sync_gaps` (
	`slot_kst` text PRIMARY KEY NOT NULL,
	`reason` text DEFAULT 'hourly-snapshot-missing' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`first_detected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text
);
