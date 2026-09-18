// Server-driven app configuration — the "POS App" tab of AIGT HDR Settings.
// Arrives in full on every pull (PullResponse.settings), is stored in the
// app_settings key/value table, and is read through src/repositories/settings.ts.
//
// Every default here equals the behaviour the app had before settings existed,
// EXCEPT maxUsesGoods (1): a hamper is one pickup. A device that has never
// pulled — fresh install, mock adapter, or a backend without the tab — runs on
// these. Keep them in step with nppos/sync_settings.py FIELDS.
//
// Pure module: no DB, no React, so adapters and repositories can both import it.

export interface PosSettings {
	maxOfflineHours: number; // 0 = never block
	transactionRetention: number; // 0 = keep everything
	showRedeemedVouchers: boolean;
	maxUsesCash: number;
	maxUsesGoods: number;
	showHamperContents: boolean;
	showBeneficiaryDetails: boolean;
	requireCloseOutPhoto: boolean;
}

export const DEFAULT_SETTINGS: PosSettings = {
	maxOfflineHours: 72,
	transactionRetention: 500,
	showRedeemedVouchers: true,
	maxUsesCash: 2,
	maxUsesGoods: 1,
	showHamperContents: true,
	showBeneficiaryDetails: true,
	requireCloseOutPhoto: false,
};

// Rebuild a typed settings object from key/value rows; anything missing or
// malformed falls back to the default for that key, never to `undefined`.
export function settingsFromRows(rows: { key: string; value: string }[]): PosSettings {
	const out: PosSettings = { ...DEFAULT_SETTINGS };
	// Writing through an index signature: the key is validated against
	// DEFAULT_SETTINGS above, and the value against the default's own type.
	const target = out as unknown as Record<string, boolean | number>;
	for (const { key, value } of rows) {
		if (!(key in DEFAULT_SETTINGS)) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(value);
		} catch {
			continue;
		}
		if (typeof DEFAULT_SETTINGS[key as keyof PosSettings] === 'boolean') {
			target[key] = Boolean(parsed);
		} else if (typeof parsed === 'number' && Number.isFinite(parsed)) {
			target[key] = parsed;
		}
	}
	return out;
}

// The redemption limit that applies to this voucher (AGENTS.md rule 4). The
// configured value wins; the voucher's own server-stamped maxUses is the
// fallback for a device that has not pulled settings yet.
export function maxUsesFor(
	voucher: { entitlementType: 'cash' | 'hamper'; maxUses: number },
	settings: PosSettings,
): number {
	const configured =
		voucher.entitlementType === 'cash' ? settings.maxUsesCash : settings.maxUsesGoods;
	return Math.max(1, configured || voucher.maxUses || 1);
}

// Setting 3: a FULLY redeemed voucher may be hidden from scans/lookups, so an
// agent gets "already redeemed" instead of the beneficiary's details. Expired
// vouchers are unaffected — they still open and explain themselves.
export function isVoucherHiddenFromScan(
	voucher: { status: string },
	settings: PosSettings,
): boolean {
	return !settings.showRedeemedVouchers && voucher.status === 'redeemed';
}
