CREATE TABLE `relay_links` (
	`id` text PRIMARY KEY NOT NULL,
	`a` text NOT NULL,
	`b` text NOT NULL,
	`a_id` text NOT NULL,
	`b_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `relay_links_a` ON `relay_links` (`a`);--> statement-breakpoint
CREATE INDEX `relay_links_b` ON `relay_links` (`b`);--> statement-breakpoint
CREATE TABLE `relay_packets` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient` text NOT NULL,
	`data` text NOT NULL,
	`final` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `relay_packets_recipient_seq` ON `relay_packets` (`recipient`,`seq`);--> statement-breakpoint
CREATE INDEX `relay_packets_expires` ON `relay_packets` (`expires`);--> statement-breakpoint
CREATE TABLE `relay_peers` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`seen` integer NOT NULL,
	`listing` text,
	`listed_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `relay_peers_seen` ON `relay_peers` (`seen`);