// Single place the app resolves its backend from. Nothing outside this
// directory names an adapter class (AGENTS.md rule 6) — the sync engine and
// auth flow call getApi() and stay adapter-agnostic.
//
// Selection: set EXPO_PUBLIC_FRAPPE_URL (e.g. in .env) to the Frappe site URL
// to run against the real backend; unset → MockAdapter on seeded dummy data.

import { FrappeAdapter } from './frappe';
import { MockAdapter } from './mock';
import type { ApiAdapter } from './types';

export * from './types';

const frappeUrl = process.env.EXPO_PUBLIC_FRAPPE_URL;

// Which backend are we actually talking to? A blank/typo'd EXPO_PUBLIC_FRAPPE_URL
// silently falls back to MockAdapter — this log makes that visible at startup.
console.log(
	`[api] backend = ${frappeUrl ? 'FrappeAdapter' : 'MockAdapter'}`,
	frappeUrl ? `(EXPO_PUBLIC_FRAPPE_URL=${frappeUrl})` : '(EXPO_PUBLIC_FRAPPE_URL not set)',
);

let adapter: ApiAdapter = frappeUrl
	? new FrappeAdapter({ baseUrl: frappeUrl })
	: new MockAdapter();

export function getApi(): ApiAdapter {
	return adapter;
}

// Test/dev escape hatch (e.g. a MockAdapter with rejectRate > 0 to exercise
// the conflict path).
export function setApi(next: ApiAdapter): void {
	adapter = next;
}
