// Typed access to the server-driven settings (src/lib/pos-settings.ts) and the
// sync-freshness rule built on them.
//
// Two shapes on purpose: mutations call the synchronous getters (hard stops
// inside a write path, where a hook cannot run), screens call the hooks (UI
// gates that must re-render when a pull lands).

import { db } from '@/db/client';
import { appSettings, syncMeta } from '@/db/schema';
import { DEFAULT_SETTINGS, settingsFromRows, type PosSettings } from '@/lib/pos-settings';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as React from 'react';

// The current configuration. A device that has never pulled — and mock mode —
// gets the built-in defaults, so there is no "settings not loaded" state.
export function getSettings(): PosSettings {
	return settingsFromRows(db.select().from(appSettings).all());
}

export function useSettings(): PosSettings {
	const { data } = useLiveQuery(db.select().from(appSettings));
	return React.useMemo(() => (data ? settingsFromRows(data) : DEFAULT_SETTINGS), [data]);
}

// ---- setting 1: max hours offline ------------------------------------------

// A successful sync stamps every collection's last_pulled_at (applyPull), so
// the newest stamp is "when this device last heard from the backend". No new
// column needed, and it survives a relaunch because it lives in SQLite.
export function lastSuccessfulSyncAt(): string | undefined {
	const rows = db.select({ at: syncMeta.lastPulledAt }).from(syncMeta).all();
	const stamps = rows.map((r) => r.at).filter((x): x is string => !!x);
	return stamps.length ? stamps.sort().at(-1) : undefined;
}

export interface SyncFreshness {
	lastSyncAt?: string;
	hoursSince: number | null; // null = never synced
	limitHours: number; // 0 = rule disabled
	isStale: boolean;
}

// Has this device been offline longer than the configured limit? A device that
// has never synced counts as stale (it has no verified voucher state at all),
// unless the rule is switched off with 0. The device clock is trusted.
export function syncFreshness(
	settings: PosSettings = getSettings(),
	now = Date.now(),
): SyncFreshness {
	const lastSyncAt = lastSuccessfulSyncAt();
	const limitHours = settings.maxOfflineHours;
	const hoursSince = lastSyncAt ? (now - new Date(lastSyncAt).getTime()) / 3_600_000 : null;
	const isStale = limitHours > 0 && (hoursSince === null || hoursSince > limitHours);
	return { lastSyncAt, hoursSince, limitHours, isStale };
}

// Live version for screens. useLiveQuery only re-runs on DB writes and
// staleness is a function of TIME, so a slow tick re-evaluates it as well —
// otherwise a device sitting idle would cross the limit without noticing.
export function useSyncFreshness(): SyncFreshness {
	const settings = useSettings();
	const { data } = useLiveQuery(db.select().from(syncMeta));
	const [tick, setTick] = React.useState(0);
	React.useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 60_000);
		return () => clearInterval(id);
	}, []);
	// `data` and `tick` are deliberate re-evaluation triggers, not inputs.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return React.useMemo(() => syncFreshness(settings), [settings, data, tick]);
}

// One wording for the refusal, so the mutation, the dashboard and the voucher
// screen all say the same thing.
export function staleSyncMessage(f: SyncFreshness): string {
	const since =
		f.hoursSince === null ? 'never synced' : `last synced ${Math.floor(f.hoursSince)}h ago`;
	return `This device has been offline too long (${since}; limit ${f.limitHours}h). Connect and sync before continuing.`;
}
