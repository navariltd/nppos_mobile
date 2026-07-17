// Single DB instance for the whole app. enableChangeListener is required for
// drizzle's useLiveQuery to react to writes (AGENTS.md).

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

export const sqlite = openDatabaseSync('nppos.db', {
	enableChangeListener: true,
});

sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite);

export type Db = typeof db;
