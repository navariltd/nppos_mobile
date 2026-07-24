// Gates the app on migrations + dev seed. Sits near the top of the provider
// stack so every screen below can assume the DB is ready.

import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { resetLocalData } from '@/repositories';

import { db, sqlite } from './client';
import migrations from './migrations/migrations';
import { seedIfEmpty } from './seed';

// EXPO_PUBLIC_RESET_DB=1  → wipe all local data once on launch (start clean and
//   rebuild from the backend). Destructive: drops unsynced outbox work. Set it,
//   relaunch once, then remove it.
// EXPO_PUBLIC_SEED=false  → skip the dummy-data seed (use when running against
//   the real Frappe backend so SQLite is populated only by sync_pull).
const RESET_DB =
	process.env.EXPO_PUBLIC_RESET_DB === '1' || process.env.EXPO_PUBLIC_RESET_DB === 'true';
const SEED_ENABLED = process.env.EXPO_PUBLIC_SEED !== 'false';

export function DbProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// Dev-tools bridge: exposes the on-device DB to Drizzle Studio.
	useDrizzleStudio(__DEV__ ? sqlite : null);

	useEffect(() => {
		let cancelled = false;
		migrate(db, migrations)
			.then(() => {
				if (RESET_DB) {
					console.log('[db] EXPO_PUBLIC_RESET_DB set — wiping local data');
					resetLocalData();
				}
				if (SEED_ENABLED) seedIfEmpty();
				if (!cancelled) setReady(true);
			})
			.catch((e: Error) => {
				if (!cancelled) setError(e);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (error) {
		// Dev-phase surface; replace with a real error screen once flows harden.
		return (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
				<Text>Database failed to initialize</Text>
				<Text style={{ marginTop: 8, opacity: 0.6 }}>{error.message}</Text>
			</View>
		);
	}

	if (!ready) return null;

	return <>{children}</>;
}
