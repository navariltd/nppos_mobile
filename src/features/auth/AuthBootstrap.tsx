// Restores the keystore token into the active ApiAdapter on relaunch, after
// redux-persist has rehydrated (mounted below PersistGate). The token isn't
// persisted in Redux (only the OS keystore), so this bridges the two: adapter
// gets its Authorization token back before the first sync. If the persisted
// session says authenticated but the keystore is empty (keychain cleared,
// reinstall), reconcile to signed-out. Renders nothing.

import { getApi } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import * as React from 'react';
import { sessionInvalidated } from './slice';
import { loadToken } from './token-storage';

export function AuthBootstrap() {
	const dispatch = useAppDispatch();
	const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

	React.useEffect(() => {
		let cancelled = false;
		loadToken().then((token) => {
			if (cancelled) return;
			if (token) {
				getApi().setToken?.(token);
			} else if (isAuthenticated) {
				dispatch(sessionInvalidated());
			}
		});
		return () => {
			cancelled = true;
		};
		// Boot-only: run once against the rehydrated state.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return null;
}
