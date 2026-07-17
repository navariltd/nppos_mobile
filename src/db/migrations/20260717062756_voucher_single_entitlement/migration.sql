ALTER TABLE `vouchers` ADD `entitlement_type` text DEFAULT 'cash' NOT NULL;--> statement-breakpoint
-- One entitlement per voucher (docs/NPPOS_WEB.md): keep the earliest row,
-- drop any extras that predate this rule.
DELETE FROM `entitlements` WHERE `voucher_id` IS NOT NULL AND rowid NOT IN (SELECT MIN(rowid) FROM `entitlements` WHERE `voucher_id` IS NOT NULL GROUP BY `voucher_id`);--> statement-breakpoint
-- Backfill the voucher's type from its surviving entitlement.
UPDATE `vouchers` SET `entitlement_type` = COALESCE((SELECT CASE WHEN e.`type` = 'hamper' THEN 'hamper' ELSE 'cash' END FROM `entitlements` e WHERE e.`voucher_id` = `vouchers`.`id` LIMIT 1), 'cash');
