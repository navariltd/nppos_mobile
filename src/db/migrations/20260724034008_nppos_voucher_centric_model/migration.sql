ALTER TABLE `assignments` ADD `project` text NOT NULL;--> statement-breakpoint
ALTER TABLE `assignments` ADD `disbursement_order` text;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `project` text NOT NULL;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD `assignment_id` text;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `hamper_id` text REFERENCES hampers(id);--> statement-breakpoint
ALTER TABLE `vouchers` ADD `qty` real;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `uom` text;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `rate` real;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `redeemed_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `redeemed_qty` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `project` text NOT NULL;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `assignment_id` text REFERENCES assignments(id);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assignments` (
	`id` text PRIMARY KEY,
	`agent_id` text NOT NULL,
	`project` text NOT NULL,
	`disbursement_order` text,
	`date` text,
	`amount_to_disburse` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_assignments`(`id`, `agent_id`, `date`, `amount_to_disburse`) SELECT `id`, `agent_id`, `date`, `amount_to_disburse` FROM `assignments`;--> statement-breakpoint
DROP TABLE `assignments`;--> statement-breakpoint
ALTER TABLE `__new_assignments` RENAME TO `assignments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_voucher_redemptions` (
	`id` text PRIMARY KEY,
	`voucher_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`pos_session_id` text,
	`type` text NOT NULL,
	`amount` real,
	`qty` real,
	`redeemed_at` text NOT NULL,
	CONSTRAINT `fk_voucher_redemptions_voucher_id_vouchers_id_fk` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_voucher_redemptions`(`id`, `voucher_id`, `transaction_id`, `pos_session_id`, `type`, `amount`, `qty`, `redeemed_at`) SELECT `id`, `voucher_id`, `transaction_id`, `pos_session_id`, `type`, `amount`, `qty`, `redeemed_at` FROM `voucher_redemptions`;--> statement-breakpoint
DROP TABLE `voucher_redemptions`;--> statement-breakpoint
ALTER TABLE `__new_voucher_redemptions` RENAME TO `voucher_redemptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_vouchers` (
	`id` text PRIMARY KEY,
	`voucher_no` text NOT NULL UNIQUE,
	`beneficiary_no` text,
	`entitlement_type` text DEFAULT 'cash' NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`hamper_id` text,
	`qty` real,
	`uom` text,
	`rate` real,
	`redeemed_amount` real DEFAULT 0 NOT NULL,
	`redeemed_qty` real DEFAULT 0 NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`uses_count` integer DEFAULT 0 NOT NULL,
	`max_uses` integer DEFAULT 2 NOT NULL,
	`project` text NOT NULL,
	`assignment_id` text,
	CONSTRAINT `fk_vouchers_hamper_id_hampers_id_fk` FOREIGN KEY (`hamper_id`) REFERENCES `hampers`(`id`),
	CONSTRAINT `fk_vouchers_assignment_id_assignments_id_fk` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_vouchers`(`id`, `voucher_no`, `beneficiary_no`, `entitlement_type`, `amount`, `valid_from`, `valid_to`, `status`, `uses_count`, `max_uses`) SELECT `id`, `voucher_no`, `beneficiary_no`, `entitlement_type`, `amount`, `valid_from`, `valid_to`, `status`, `uses_count`, `max_uses` FROM `vouchers`;--> statement-breakpoint
DROP TABLE `vouchers`;--> statement-breakpoint
ALTER TABLE `__new_vouchers` RENAME TO `vouchers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `beneficiaries_no_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `entitlements_beneficiary_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `entitlements_voucher_idx`;--> statement-breakpoint
CREATE INDEX `voucher_redemptions_voucher_idx` ON `voucher_redemptions` (`voucher_id`);--> statement-breakpoint
CREATE INDEX `vouchers_beneficiary_no_idx` ON `vouchers` (`beneficiary_no`);--> statement-breakpoint
DROP TABLE `beneficiaries`;--> statement-breakpoint
DROP TABLE `disbursement_orders`;--> statement-breakpoint
DROP TABLE `entitlements`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `pos_transactions` DROP COLUMN `beneficiary_id`;--> statement-breakpoint
ALTER TABLE `pos_transactions` DROP COLUMN `entitlement_id`;--> statement-breakpoint
ALTER TABLE `pos_transactions` DROP COLUMN `project_id`;--> statement-breakpoint
ALTER TABLE `pos_transactions` DROP COLUMN `disbursement_order_id`;