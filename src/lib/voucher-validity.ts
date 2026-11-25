// A voucher's validity window, judged on the device's date.
//
// The server derives `expired` from valid_to when it builds a pull, but a
// voucher pulled while active stays 'active' in SQLite until it is pulled
// again — and a delta pull only re-sends vouchers that changed. So expiry is
// recomputed from the dates wherever a voucher is read: the row mapper (every
// list, badge and screen) and the redemption guard. Pure module.
//
// Dates are 'YYYY-MM-DD' strings. The backend leaves valid_from/valid_to blank
// ('') on open-ended vouchers, and '' must not read as expired (any date string
// compares greater than '').

import type { VoucherStatus } from '@/types/domain';

export type VoucherValidity =
	| { state: 'valid' }
	| { state: 'expired'; on: string } // last valid day
	| { state: 'not_yet'; from: string }; // first valid day

// Same day the redemption guard has always used (UTC date of now).
export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export function voucherValidity(
	v: { validFrom?: string | null; validTo?: string | null },
	day: string = todayIso(),
): VoucherValidity {
	if (v.validTo && day > v.validTo) return { state: 'expired', on: v.validTo };
	if (v.validFrom && day < v.validFrom) return { state: 'not_yet', from: v.validFrom };
	return { state: 'valid' };
}

// The status to show and act on: a still-redeemable status flips to 'expired'
// once the window has passed. Redeemed stays redeemed (that is the more
// useful fact), and an expired one stays expired.
export function effectiveVoucherStatus(
	v: { status: VoucherStatus; validFrom?: string | null; validTo?: string | null },
	day: string = todayIso(),
): VoucherStatus {
	if (
		(v.status === 'active' || v.status === 'partially_redeemed') &&
		voucherValidity(v, day).state === 'expired'
	) {
		return 'expired';
	}
	return v.status;
}
