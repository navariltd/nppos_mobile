CREATE TABLE `pos_profiles` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`agent_id` text NOT NULL,
	`warehouse` text NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pos_sessions` (
	`id` text PRIMARY KEY,
	`pos_profile_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`opening_float` real DEFAULT 0 NOT NULL,
	`expected_cash` real,
	`counted_cash` real,
	`opening_server_name` text,
	`closing_server_name` text,
	CONSTRAINT `fk_pos_sessions_pos_profile_id_pos_profiles_id_fk` FOREIGN KEY (`pos_profile_id`) REFERENCES `pos_profiles`(`id`)
);
--> statement-breakpoint
CREATE TABLE `voucher_redemptions` (
	`id` text PRIMARY KEY,
	`voucher_id` text NOT NULL,
	`entitlement_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`pos_session_id` text,
	`type` text NOT NULL,
	`amount` real,
	`qty` real,
	`redeemed_at` text NOT NULL,
	CONSTRAINT `fk_voucher_redemptions_voucher_id_vouchers_id_fk` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`),
	CONSTRAINT `fk_voucher_redemptions_entitlement_id_entitlements_id_fk` FOREIGN KEY (`entitlement_id`) REFERENCES `entitlements`(`id`)
);
--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `pos_session_id` text;--> statement-breakpoint
CREATE INDEX `pos_sessions_status_idx` ON `pos_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `voucher_redemptions_voucher_idx` ON `voucher_redemptions` (`voucher_id`);