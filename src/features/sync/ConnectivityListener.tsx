// Feeds real device connectivity (NetInfo) into the sync slice. Renders
// nothing; mounted once inside the store provider. `isInternetReachable` is
// null while NetInfo is still probing — treat only an explicit false as
// unreachable so startup doesn't flicker offline.

import { deviceOnlineChanged } from '@/features/sync/slice';
import { useAppDispatch } from '@/store/hooks';
import NetInfo from '@react-native-community/netinfo';
import * as React from 'react';

export function ConnectivityListener() {
	const dispatch = useAppDispatch();

	React.useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((state) => {
			const online = (state.isConnected ?? false) && state.isInternetReachable !== false;
			dispatch(deviceOnlineChanged(online));
		});
		return unsubscribe;
	}, [dispatch]);

	return null;
}
