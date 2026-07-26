// Currency — single source of truth for money formatting. The active POS
// profile carries a currency CODE (e.g. "SDG"); everything the UI needs
// (symbol, placement, decimals, grouping) is derived here so screens never
// hardcode a currency again. Consume it through the useCurrency() hook, which
// binds this to the active profile; this module stays framework-free.
//
// The shape mirrors the ERPNext **Currency** doctype (symbol, symbol_on_right,
// number_format, fraction/fraction_units) so this local registry can later be
// replaced/augmented by rows pulled from the backend without changing callers.

export interface CurrencyInfo {
	/** ISO 4217 / ERPNext currency_name, e.g. "SDG". */
	code: string;
	/** Display symbol, e.g. "ج.س." — falls back to the code when unknown. */
	symbol: string;
	/** ERPNext symbol_on_right — true renders "1,234 ج.س.", false "ج.س. 1,234". */
	symbolOnRight: boolean;
	/** Human-readable name, e.g. "Sudanese Pound". */
	name: string;
	/** Sub-unit name (ERPNext fraction), e.g. "Piastre". */
	fraction?: string;
	/** Sub-units per unit (ERPNext fraction_units), e.g. 100. */
	fractionUnits?: number;
	/** BCP-47 locale used for digit grouping. */
	locale: string;
	/** Fraction digits to show at most (from number_format). */
	decimals: number;
}

// App is for the Sudan HDR programme — SDG is the default before a profile is
// picked (pre-selection screens).
export const DEFAULT_CURRENCY_CODE = 'SDG';

// Known currencies, extend as needed. Anything not listed still works via
// getCurrency()'s fallback (symbol = code).
const REGISTRY: Record<string, CurrencyInfo> = {
	SDG: {
		code: 'SDG',
		symbol: 'ج.س.',
		symbolOnRight: false,
		name: 'Sudanese Pound',
		fraction: 'Piastre',
		fractionUnits: 100,
		locale: 'en',
		decimals: 2,
	},
	KES: {
		code: 'KES',
		symbol: 'KSh',
		symbolOnRight: false,
		name: 'Kenyan Shilling',
		fraction: 'Cent',
		fractionUnits: 100,
		locale: 'en-KE',
		decimals: 2,
	},
	USD: {
		code: 'USD',
		symbol: '$',
		symbolOnRight: false,
		name: 'US Dollar',
		fraction: 'Cent',
		fractionUnits: 100,
		locale: 'en-US',
		decimals: 2,
	},
	EUR: {
		code: 'EUR',
		symbol: '€',
		symbolOnRight: false,
		name: 'Euro',
		fraction: 'Cent',
		fractionUnits: 100,
		locale: 'en-IE',
		decimals: 2,
	},
	GBP: {
		code: 'GBP',
		symbol: '£',
		symbolOnRight: false,
		name: 'British Pound',
		fraction: 'Penny',
		fractionUnits: 100,
		locale: 'en-GB',
		decimals: 2,
	},
	EGP: {
		code: 'EGP',
		symbol: 'ج.م.',
		symbolOnRight: false,
		name: 'Egyptian Pound',
		fraction: 'Piastre',
		fractionUnits: 100,
		locale: 'en',
		decimals: 2,
	},
	ETB: {
		code: 'ETB',
		symbol: 'Br',
		symbolOnRight: false,
		name: 'Ethiopian Birr',
		fraction: 'Santim',
		fractionUnits: 100,
		locale: 'en-ET',
		decimals: 2,
	},
	SSP: {
		code: 'SSP',
		symbol: '£',
		symbolOnRight: false,
		name: 'South Sudanese Pound',
		fraction: 'Piaster',
		fractionUnits: 100,
		locale: 'en',
		decimals: 2,
	},
	UGX: {
		code: 'UGX',
		symbol: 'USh',
		symbolOnRight: false,
		name: 'Ugandan Shilling',
		locale: 'en-UG',
		decimals: 0,
	},
};

/** Resolve currency metadata for a code, tolerating unknown/blank codes. */
export function getCurrency(code?: string | null): CurrencyInfo {
	const normalized = (code ?? '').trim().toUpperCase();
	if (normalized && REGISTRY[normalized]) return REGISTRY[normalized];
	if (normalized) {
		// Unknown code — still usable: show the code itself as the "symbol".
		return {
			code: normalized,
			symbol: normalized,
			symbolOnRight: false,
			name: normalized,
			locale: 'en',
			decimals: 2,
		};
	}
	return REGISTRY[DEFAULT_CURRENCY_CODE];
}

/**
 * Format an amount in the given currency, honoring symbol placement:
 * formatMoney(1234.5, "SDG") → "ج.س. 1,234.5". Returns "—" for nullish amounts
 * (matches the old helper).
 */
export function formatMoney(amount?: number | null, code?: string | null): string {
	if (amount == null || Number.isNaN(amount)) return '—';
	const c = getCurrency(code);
	const digits = amount.toLocaleString(c.locale, {
		minimumFractionDigits: 0,
		maximumFractionDigits: c.decimals,
	});
	return c.symbolOnRight ? `${digits} ${c.symbol}` : `${c.symbol} ${digits}`;
}
