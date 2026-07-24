// Sync-engine status — runtime-only, never persisted. Pending/conflict COUNTS
// stay in SQLite (useSyncCounts) per AGENTS.md rule 1; this slice only tracks
// the engine's own state: connectivity, in-flight flag, last outcome.
//
// Connectivity is two flags:
// - deviceOnline — the real network state, driven by NetInfo (ConnectivityListener).
// - forcedOffline — the "simulate offline" dev switch (Profile screen); lets
//   you test offline behavior without touching airplane mode.
// Everything in the app reads the EFFECTIVE state via selectIsOnline — online
// only when the device is connected AND not simulating.

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface SyncState {
	deviceOnline: boolean;
	forcedOffline: boolean;
	isSyncing: boolean;
	lastSyncAt: string | null;
	lastError: string | null;
}

const initialState: SyncState = {
	deviceOnline: true,
	forcedOffline: false,
	isSyncing: false,
	lastSyncAt: null,
	lastError: null,
};

const syncSlice = createSlice({
	name: 'sync',
	initialState,
	reducers: {
		deviceOnlineChanged: (state, action: PayloadAction<boolean>) => {
			state.deviceOnline = action.payload;
		},
		forcedOfflineSet: (state, action: PayloadAction<boolean>) => {
			state.forcedOffline = action.payload;
		},
		syncStarted: (state) => {
			state.isSyncing = true;
			state.lastError = null;
		},
		syncFinished: (state, action: PayloadAction<{ at: string }>) => {
			state.isSyncing = false;
			state.lastSyncAt = action.payload.at;
		},
		syncFailed: (state, action: PayloadAction<{ error: string }>) => {
			state.isSyncing = false;
			state.lastError = action.payload.error;
		},
	},
});

export const selectIsOnline = (s: { sync: SyncState }): boolean =>
	s.sync.deviceOnline && !s.sync.forcedOffline;

export const { deviceOnlineChanged, forcedOfflineSet, syncStarted, syncFinished, syncFailed } =
	syncSlice.actions;
export default syncSlice.reducer;
