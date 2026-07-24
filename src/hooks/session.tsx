// Session hook — same consumer API as the old Context version, now backed by
// the Redux auth slice (persisted; sign-in goes through the ApiAdapter).
//
// The session has two steps: system login (email/password) and then choosing a
// POS profile to work under — the profile's warehouse scopes the stock view.
// Sign-out drops the whole session, active profile included.

import {
	logout,
	posProfileSelected,
	roleSet,
	signIn as signInThunk,
} from '@/features/auth/slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { Role } from '@/types/domain';
import * as React from 'react';

export type SignInResult = { ok: true } | { ok: false; reason: string };

export function useSession() {
	const dispatch = useAppDispatch();
	const { isAuthenticated, agent, role, activePosProfileId, isSigningIn } = useAppSelector(
		(s) => s.auth,
	);

	const signIn = React.useCallback(
		async (req: { email: string; password: string; role: Role }): Promise<SignInResult> => {
			try {
				await dispatch(signInThunk(req)).unwrap();
				return { ok: true };
			} catch (e) {
				// unwrap() rejects with a SerializedError (plain object), not an
				// Error instance — read .message off either shape.
				const message = (e as { message?: string })?.message;
				return { ok: false, reason: message || 'Sign-in failed.' };
			}
		},
		[dispatch],
	);

	return {
		isAuthenticated,
		name: agent?.name ?? '',
		agent,
		role,
		activePosProfileId,
		isSigningIn,
		signIn,
		signOut: React.useCallback(() => dispatch(logout()), [dispatch]),
		setRole: React.useCallback((r: Role) => dispatch(roleSet(r)), [dispatch]),
		selectPosProfile: React.useCallback(
			(id: string) => dispatch(posProfileSelected(id)),
			[dispatch],
		),
	};
}
