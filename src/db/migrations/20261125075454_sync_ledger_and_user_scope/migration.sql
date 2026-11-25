ALTER TABLE `pos_sessions` ADD `user` text;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `user` text;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `ledger_name` text;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `resolution` text;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `resolution_note` text;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `resolved_by` text;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `resolved_at` text;--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD `user` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_voucher_redemptions` (
	`id` text PRIMARY KEY,
	`voucher_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`pos_session_id` text,
	`pos_opening_entry` text,
	`type` text NOT NULL,
	`amount` real,
	`qty` real,
	`redeemed_at` text NOT NULL,
	`user` text
);
--> statement-breakpoint
INSERT INTO `__new_voucher_redemptions`(`id`, `voucher_id`, `transaction_id`, `pos_session_id`, `pos_opening_entry`, `type`, `amount`, `qty`, `redeemed_at`) SELECT `id`, `voucher_id`, `transaction_id`, `pos_session_id`, `pos_opening_entry`, `type`, `amount`, `qty`, `redeemed_at` FROM `voucher_redemptions`;--> statement-breakpoint
DROP TABLE `voucher_redemptions`;--> statement-breakpoint
ALTER TABLE `__new_voucher_redemptions` RENAME TO `voucher_redemptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `voucher_redemptions_voucher_idx` ON `voucher_redemptions` (`voucher_id`);--> statement-breakpoint
CREATE INDEX `pos_transactions_user_idx` ON `pos_transactions` (`user`);