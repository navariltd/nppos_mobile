// Who and where the agent is working — the scope every user-owned list and
// count is filtered by (see WorkScope in src/repositories/queries.ts). The user
// is the signed-in login email (the same value mutations stamp on each row via
// deviceOwner()); the warehouse is the active POS profile's.

import { useActivePosProfile } from '@/hooks/pos-profile';
import type { WorkScope } from '@/repositories';
import { useAppSelector } from '@/store/hooks';

export function useCurrentUser(): string | null {
	return useAppSelector((s) => s.auth.agent?.email ?? null);
}

export function useWorkScope(): WorkScope {
	const user = useCurrentUser();
	const profile = useActivePosProfile();
	return { user, warehouse: profile?.warehouse ?? null };
}
