CREATE TABLE `agent_stock` (
	`hamper_id` text PRIMARY KEY,
	`hamper_name` text NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`issued_today` integer DEFAULT 0 NOT NULL,
	`damaged` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_agent_stock_hamper_id_hampers_id_fk` FOREIGN KEY (`hamper_id`) REFERENCES `hampers`(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY,
	`disbursement_order_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`date` text,
	`amount_to_disburse` real DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_assignments_disbursement_order_id_disbursement_orders_id_fk` FOREIGN KEY (`disbursement_order_id`) REFERENCES `disbursement_orders`(`id`)
);
--> statement-breakpoint
CREATE TABLE `beneficiaries` (
	`id` text PRIMARY KEY,
	`beneficiary_no` text NOT NULL,
	`name` text NOT NULL,
	`national_id` text,
	`phone` text,
	`household_size` integer DEFAULT 1 NOT NULL,
	`project_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`last_issued_at` text,
	CONSTRAINT `fk_beneficiaries_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
);
--> statement-breakpoint
CREATE TABLE `disbursement_orders` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`project_id` text NOT NULL,
	`disbursement_type` text DEFAULT 'cash' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`total_beneficiaries` integer DEFAULT 0 NOT NULL,
	`issued_count` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_disbursement_orders_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`hamper_id` text,
	`qty` real,
	`amount` real,
	`status` text DEFAULT 'available' NOT NULL,
	`beneficiary_id` text,
	`voucher_id` text,
	`project_id` text NOT NULL,
	`disbursement_order_id` text NOT NULL,
	CONSTRAINT `fk_entitlements_hamper_id_hampers_id_fk` FOREIGN KEY (`hamper_id`) REFERENCES `hampers`(`id`),
	CONSTRAINT `fk_entitlements_beneficiary_id_beneficiaries_id_fk` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`),
	CONSTRAINT `fk_entitlements_voucher_id_vouchers_id_fk` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`),
	CONSTRAINT `fk_entitlements_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`),
	CONSTRAINT `fk_entitlements_disbursement_order_id_disbursement_orders_id_fk` FOREIGN KEY (`disbursement_order_id`) REFERENCES `disbursement_orders`(`id`)
);
--> statement-breakpoint
CREATE TABLE `hamper_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`hamper_id` text NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`qty_per_household` real DEFAULT 1 NOT NULL,
	CONSTRAINT `fk_hamper_items_hamper_id_hampers_id_fk` FOREIGN KEY (`hamper_id`) REFERENCES `hampers`(`id`)
);
--> statement-breakpoint
CREATE TABLE `hampers` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY,
	`payload` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_retry_at` text,
	`last_error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pos_transactions` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`amount` real,
	`qty` real,
	`beneficiary_id` text,
	`beneficiary_name` text,
	`voucher_no` text,
	`entitlement_id` text,
	`project_id` text NOT NULL,
	`disbursement_order_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`synced_at` text,
	`server_name` text
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`collection` text PRIMARY KEY,
	`cursor` text,
	`last_pulled_at` text
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` text PRIMARY KEY,
	`voucher_no` text NOT NULL UNIQUE,
	`beneficiary_no` text,
	`amount` real DEFAULT 0 NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`uses_count` integer DEFAULT 0 NOT NULL,
	`max_uses` integer DEFAULT 2 NOT NULL,
	`project_id` text NOT NULL,
	`disbursement_order_id` text NOT NULL,
	CONSTRAINT `fk_vouchers_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`),
	CONSTRAINT `fk_vouchers_disbursement_order_id_disbursement_orders_id_fk` FOREIGN KEY (`disbursement_order_id`) REFERENCES `disbursement_orders`(`id`)
);
--> statement-breakpoint
CREATE INDEX `beneficiaries_no_idx` ON `beneficiaries` (`beneficiary_no`);--> statement-breakpoint
CREATE INDEX `entitlements_beneficiary_idx` ON `entitlements` (`beneficiary_id`);--> statement-breakpoint
CREATE INDEX `entitlements_voucher_idx` ON `entitlements` (`voucher_id`);--> statement-breakpoint
CREATE INDEX `pos_transactions_status_idx` ON `pos_transactions` (`status`);--> statement-breakpoint
CREATE INDEX `vouchers_beneficiary_no_idx` ON `vouchers` (`beneficiary_no`);