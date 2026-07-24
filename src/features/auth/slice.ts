// Auth slice — session/identity only (AGENTS.md rule 1: no domain rows in
// Redux). Persisted via redux-persist (whitelisted in src/store) so a relaunch
// lands past login — BUT never the token: that lives in the OS keystore
// (./token-storage), held in memory by the ApiAdapter. POS profiles returned by
// login are upserted into SQLite (reference data), not kept here.

import { selectIsOnline, type SyncState } from '@/features/sync/slice';
import { replacePosProfiles } from '@/repositories';
import { getApi } from '@/services/api';
import type { Agent, Role } from '@/types/domain';
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import { clearToken, saveToken } from './token-storage';

export interface AuthState {
	isAuthenticated: boolean;
	agent: Agent | null;
	// Active view role. The login screen's Agent/Admin toggle (and the profile
	// switch) drive this in the dummy build; real builds derive it from the
	// backend user's roles.
	role: Role;
	// The POS profile chosen after login — the session's working context
	// (warehouse, currency). null until picked; the (app) guard redirects to
	// /select-profile. Cleared on sign-out (full-system logout).
	activePosProfileId: string | null;
	isSigningIn: boolean;
}

const initialState: AuthState = {
	isAuthenticated: false,
	agent: null,
	role: 'agent',
	activePosProfileId: null,
	isSigningIn: false,
};

export const signIn = createAsyncThunk(
	'auth/signIn',
	async (req: { email: string; password: string; role: Role }, thunkAPI) => {
		// Honor the effective connectivity state (device + simulate-offline
		// switch) — login is an online-only action (ARCHITECTURE.md §7.1).
		if (!selectIsOnline(thunkAPI.getState() as { sync: SyncState })) {
			throw new Error('You are offline — signing in needs a connection.');
		}
		const { token, agent, posProfiles } = await getApi().login({
			email: req.email,
			password: req.password,
		});
		// Token → keystore + adapter memory (never Redux/AsyncStorage).
		await saveToken(token);
		getApi().setToken?.(token);
		// Profiles → SQLite so the picker works before the first pull. Replace
		// (not merge): local set becomes exactly what login returned for this
		// user, so stale/seed profiles are cleared.
		replacePosProfiles(posProfiles);
		return { agent, role: req.role };
	},
);

// Full-system sign-out: drop the keystore token and the adapter's copy, then
// reset session state (active profile included).
export const logout = createAsyncThunk('auth/logout', async () => {
	await clearToken();
	getApi().setToken?.(null);
});

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		roleSet: (state, action: PayloadAction<Role>) => {
			state.role = action.payload;
		},
		posProfileSelected: (state, action: PayloadAction<string>) => {
			state.activePosProfileId = action.payload;
		},
		// Boot reconcile (AuthBootstrap): persisted state said authenticated but
		// the keystore has no token — treat as signed out.
		sessionInvalidated: () => initialState,
	},
	extraReducers: (builder) => {
		builder
			.addCase(signIn.pending, (state) => {
				state.isSigningIn = true;
			})
			.addCase(signIn.fulfilled, (state, action) => {
				state.isSigningIn = false;
				state.isAuthenticated = true;
				state.agent = action.payload.agent;
				state.role = action.payload.role;
			})
			.addCase(signIn.rejected, (state) => {
				state.isSigningIn = false;
			})
			.addCase(logout.fulfilled, () => initialState)
			.addCase(logout.rejected, () => initialState)
			// App killed mid-login shouldn't rehydrate a stuck "Signing in…".
			.addMatcher(
				(action) => action.type === REHYDRATE,
				(state) => {
					state.isSigningIn = false;
				},
			);
	},
});

export const { roleSet, posProfileSelected, sessionInvalidated } = authSlice.actions;
export default authSlice.reducer;
