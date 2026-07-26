// useCurrency — the app-wide money formatter, bound to the active POS profile's
// currency. Any screen that shows an amount uses this instead of hardcoding a
// currency: `const { format } = useCurrency(); … format(amount)`. It also
// exposes the resolved metadata (code, symbol, name, symbolOnRight) for labels
// like "Counted cash (ج.س.)".

import { useActivePosProfile } from '@/hooks/pos-profile';
import { DEFAULT_CURRENCY_CODE, formatMoney, getCurrency, type CurrencyInfo } from '@/lib/currency';
import * as React from 'react';

export interface UseCurrency extends CurrencyInfo {
	/** Format an amount in the active currency, e.g. "ج.س. 1,234.5". */
	format: (amount?: number | null) => string;
}

export function useCurrency(): UseCurrency {
	const profile = useActivePosProfile();
	const code = profile?.currency ?? DEFAULT_CURRENCY_CODE;
	const info = React.useMemo(() => getCurrency(code), [code]);
	const format = React.useCallback((amount?: number | null) => formatMoney(amount, code), [code]);
	return { ...info, format };
}
