CREATE TABLE `beneficiaries` (
	`id` text PRIMARY KEY,
	`full_name` text NOT NULL,
	`id_number` text,
	`status` text,
	`phone` text,
	`household_size` integer DEFAULT 0 NOT NULL,
	`beneficiary_type` text,
	`district` text
);
--> statement-breakpoint
CREATE TABLE `bom_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`bom_id` text NOT NULL,
	`item_code` text NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`qty` real DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_bom_items_bom_id_boms_id_fk` FOREIGN KEY (`bom_id`) REFERENCES `boms`(`id`)
);
--> statement-breakpoint
CREATE TABLE `boms` (
	`id` text PRIMARY KEY,
	`item_code` text NOT NULL,
	`item_name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`uom` text
);
--> statement-breakpoint
ALTER TABLE `agent_stock` ADD `bom_id` text REFERENCES boms(id);--> statement-breakpoint
ALTER TABLE `pos_sessions` ADD `closing_photo_uri` text;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `bom_id` text REFERENCES boms(id);--> statement-breakpoint
CREATE INDEX `bom_items_bom_idx` ON `bom_items` (`bom_id`);