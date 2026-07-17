import * as Crypto from 'expo-crypto';

// Client-generated id for every local mutation — doubles as the sync
// idempotency key (AGENTS.md rule 3), so it must never be regenerated.
export function uuid(): string {
	return Crypto.randomUUID();
}
