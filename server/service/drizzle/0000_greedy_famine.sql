CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`public` integer NOT NULL,
	`host` text NOT NULL,
	`guest` text,
	`host_seen` integer NOT NULL,
	`guest_seen` integer DEFAULT 0 NOT NULL,
	`host_messages` integer DEFAULT 0 NOT NULL,
	`guest_messages` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rooms_public_seen` ON `rooms` (`public`,`host_seen`);