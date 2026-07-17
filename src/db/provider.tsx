// Gates the app on migrations + dev seed. Sits near the top of the provider
// stack so every screen below can assume the DB is ready.

import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { db, sqlite } from './client';
import migrations from './migrations/migrations';
import { seedIfEmpty } from './seed';

export function DbProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// Dev-tools bridge: exposes the on-device DB to Drizzle Studio.
	useDrizzleStudio(__DEV__ ? sqlite : null);

	useEffect(() => {
		let cancelled = false;
		migrate(db, migrations)
			.then(() => {
				seedIfEmpty();
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
