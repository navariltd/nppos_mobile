// Fires the sync engine on its triggers (ARCHITECTURE.md §4): coming online,
// app returning to foreground, a slow safety interval, and app start. Renders
// nothing. Must be mounted BELOW DbProvider — the engine reads SQLite.
// Manual "Sync now" (Profile) and reconciliation dispatch syncNow themselves.

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import * as React from 'react';
import { AppState } from 'react-native';
import { syncNow } from './engine';
import { selectIsOnline } from './slice';

const INTERVAL_MS = 60_000;

// The adapter's token is restored/cleared by AuthBootstrap and the auth thunks,
// not here — this component only fires the engine's triggers.
export function SyncManager() {
	const dispatch = useAppDispatch();
	const isOnline = useAppSelector(selectIsOnline);
	const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

	const kick = React.useCallback(() => {
		if (!isAuthenticated || !isOnline) return;
		// Rejections (offline race, overlap-skip) are expected — swallow them;
		// the sync slice carries any real error for the UI.
		dispatch(syncNow())
			.unwrap()
			.catch(() => {});
	}, [dispatch, isAuthenticated, isOnline]);

	// Coming online (also fires once on mount when starting online).
	const wasOnline = React.useRef(false);
	React.useEffect(() => {
		if (isOnline && !wasOnline.current) kick();
		wasOnline.current = isOnline;
	}, [isOnline, kick]);

	// App returns to foreground.
	React.useEffect(() => {
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') kick();
		});
		return () => sub.remove();
	}, [kick]);

	// Safety net for anything the other triggers missed (backoff retries).
	React.useEffect(() => {
		const id = setInterval(kick, INTERVAL_MS);
		return () => clearInterval(id);
	}, [kick]);

	return null;
}
