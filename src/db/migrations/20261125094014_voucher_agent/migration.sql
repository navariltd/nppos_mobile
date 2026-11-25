ALTER TABLE `vouchers` ADD `agent_id` text;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `agent_name` text;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `agent_user` text;--> statement-breakpoint
-- Vouchers already on the device have no agent until the server re-sends them,
-- and a delta pull only re-sends vouchers that changed. Drop the voucher and
-- warehouse cursors so the next pull sends the full (bounded) set with agents.
DELETE FROM `sync_meta` WHERE `collection` IN ('vouchers', 'warehouses');
