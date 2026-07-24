// The POS profile the session is working under: id from the auth slice,
// row (name, warehouse, currency) live from SQLite. Screens use this for
// everything profile-scoped — most importantly the stock warehouse.

import { useSession } from '@/hooks/session';
import { usePosProfile } from '@/repositories';
import type { PosProfile } from '@/types/domain';

export function useActivePosProfile(): PosProfile | undefined {
	const { activePosProfileId } = useSession();
	return usePosProfile(activePosProfileId ?? undefined);
}
