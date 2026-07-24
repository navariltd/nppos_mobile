// RTK store (docs/ARCHITECTURE.md §1): session/auth, sync-engine status, and
// nothing else — domain data lives in SQLite. Only `auth` is persisted
// (redux-persist over AsyncStorage) so a relaunch lands past the login screen —
// and auth holds NO token (that's in the OS keystore, see auth/token-storage);
// sync status is runtime-only and rebuilds from the outbox/NetInfo.

import authReducer from '@/features/auth/slice';
import syncReducer from '@/features/sync/slice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
	FLUSH,
	PAUSE,
	PERSIST,
	persistReducer,
	persistStore,
	PURGE,
	REGISTER,
	REHYDRATE,
} from 'redux-persist';

const rootReducer = combineReducers({
	auth: authReducer,
	sync: syncReducer,
});

const persistedReducer = persistReducer(
	{
		key: 'nppos',
		storage: AsyncStorage,
		whitelist: ['auth'],
	},
	rootReducer,
);

export const store = configureStore({
	reducer: persistedReducer,
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				// redux-persist actions carry non-serializable callbacks by design.
				ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
			},
		}),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
