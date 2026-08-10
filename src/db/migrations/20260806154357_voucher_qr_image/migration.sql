-- Server-generated QR code file url on the voucher (/files/<voucherNo>-qr.png).
-- drizzle-kit also wanted to rebuild `pos_profiles` here for an unrelated
-- default drift (currency 'KES' -> 'SDG'); that rebuild was dropped on purpose —
-- it would DROP a table `pos_sessions` has a live FK to, and the default is
-- never used (every upsert supplies currency).
ALTER TABLE `vouchers` ADD `image` text;
