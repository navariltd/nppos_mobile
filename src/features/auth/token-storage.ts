// The auth token lives in the OS keystore (expo-secure-store), NOT in
// redux-persist/AsyncStorage — those are plaintext. It's held in memory by the
// active ApiAdapter for the Authorization header, restored here on relaunch
// (AuthBootstrap), and cleared on sign-out. The password is never stored at
// all; offline PIN re-auth (ARCHITECTURE.md §7.1) is a separate future flow.

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'nppos.auth.token';

export async function saveToken(token: string): Promise<void> {
	await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
	return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
	await SecureStore.deleteItemAsync(TOKEN_KEY);
}
