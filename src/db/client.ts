// Single DB instance for the whole app. enableChangeListener is required for
// drizzle's useLiveQuery to react to writes (AGENTS.md).

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { deleteDatabaseSync, openDatabaseSync } from 'expo-sqlite';

const DB_NAME = 'nppos.db';

// EXPO_PUBLIC_RESET_DB=1 → delete the DB file BEFORE opening, so migrations run
// against an empty database. This is the reset path after a destructive schema
// change (e.g. the voucher-centric refactor) whose migration can't apply in
// place over existing rows. Destructive: drops all local + unsynced data. Set
// it, relaunch once, then remove it. (Wiping the file also clears the recorded
// migration history, so the whole migration chain re-applies from scratch.)
const RESET_DB =
	process.env.EXPO_PUBLIC_RESET_DB === '1' || process.env.EXPO_PUBLIC_RESET_DB === 'true';

if (RESET_DB) {
	try {
		deleteDatabaseSync(DB_NAME);
		console.log('[db] EXPO_PUBLIC_RESET_DB set — deleted local DB, rebuilding fresh');
	} catch {
		// No existing DB file yet (first launch) — nothing to delete.
	}
}

export const sqlite = openDatabaseSync(DB_NAME, {
	enableChangeListener: true,
});

sqlite.execSync('PRAGMA foreign_keys = ON;');
// WAL: readers never block a writer's COMMIT (and vice versa). In the default
// rollback journal a COMMIT needs every other connection to have stopped
// reading — and in dev a JS reload can leave the previous runtime's connection
// open mid-read, so every later pull failed at COMMIT with "database is
// locked". busy_timeout makes any remaining contention wait instead of failing
// on the first try.
sqlite.execSync('PRAGMA journal_mode = WAL;');
sqlite.execSync('PRAGMA busy_timeout = 5000;');

export const db = drizzle(sqlite);

export type Db = typeof db;
