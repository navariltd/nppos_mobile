-- Align voucher statuses with the backend Entitlement Voucher vocabulary
-- (docs/NPPOS_WEB.md): 'exhausted' became 'redeemed'; vouchers with uses left
-- but at least one redemption are 'partially_redeemed'.
UPDATE `vouchers` SET `status` = 'redeemed' WHERE `status` = 'exhausted';--> statement-breakpoint
UPDATE `vouchers` SET `status` = 'partially_redeemed' WHERE `status` = 'active' AND `uses_count` > 0;
