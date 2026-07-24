import { forcedOfflineSet, selectIsOnline } from '@/features/sync/slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import * as React from 'react';

export function useOnline() {
	const dispatch = useAppDispatch();
	const isOnline = useAppSelector(selectIsOnline);
	const deviceOnline = useAppSelector((s) => s.sync.deviceOnline);
	const forcedOffline = useAppSelector((s) => s.sync.forcedOffline);

	return {
		isOnline,
		deviceOnline,
		forcedOffline,
		setForcedOffline: React.useCallback(
			(v: boolean) => dispatch(forcedOfflineSet(v)),
			[dispatch],
		),
	};
}
