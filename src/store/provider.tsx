// Store + rehydration gate. PersistGate holds children until the persisted
// auth slice is back, so the (app) auth guard never sees a pre-rehydration
// "logged out" flash on relaunch.

import { AuthBootstrap } from '@/features/auth/AuthBootstrap';
import { ConnectivityListener } from '@/features/sync/ConnectivityListener';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from './index';

export function StoreProvider({ children }: { children: React.ReactNode }) {
	return (
		<Provider store={store}>
			<PersistGate loading={null} persistor={persistor}>
				<AuthBootstrap />
				<ConnectivityListener />
				{children}
			</PersistGate>
		</Provider>
	);
}
