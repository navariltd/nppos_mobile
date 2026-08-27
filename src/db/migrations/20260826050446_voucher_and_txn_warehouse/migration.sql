ALTER TABLE `pos_transactions` ADD `warehouse` text;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `warehouse` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `vouchers_warehouse_idx` ON `vouchers` (`warehouse`);