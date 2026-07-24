PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agent_stock` (
	`warehouse` text NOT NULL,
	`hamper_id` text NOT NULL,
	`hamper_name` text NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`issued_today` integer DEFAULT 0 NOT NULL,
	`damaged` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `agent_stock_pk` PRIMARY KEY(`warehouse`, `hamper_id`),
	CONSTRAINT `fk_agent_stock_hamper_id_hampers_id_fk` FOREIGN KEY (`hamper_id`) REFERENCES `hampers`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_agent_stock`(`warehouse`, `hamper_id`, `hamper_name`, `on_hand`, `issued_today`, `damaged`) SELECT 'WH-NRB-014', `hamper_id`, `hamper_name`, `on_hand`, `issued_today`, `damaged` FROM `agent_stock`;--> statement-breakpoint
DROP TABLE `agent_stock`;--> statement-breakpoint
ALTER TABLE `__new_agent_stock` RENAME TO `agent_stock`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
