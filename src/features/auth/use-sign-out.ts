// The ONE way a person signs out. Every sign-out button goes through here so no
// screen can skip the sync gate (AGENTS.md rule 2):
//
//   online → forced flush + pull → outbox empty → close any open shift →
//   push the closing entry → outbox empty again → drop the session.
//
// The outbox is checked directly after each flush rather than trusting the
// flush to throw: the sync engine swallows a failed push (backs it off and
// stops the flush) and still resolves, so "flush didn't throw" does NOT mean
// "everything reached the server". Signing out with work queued would strand
// it until that same user logs back in on this same device — or worse, push it
// under the next user's token.
//
// The `logout` thunk refuses on its own when the outbox is non-empty, as a
// backstop for any dispatch that bypasses this hook.

import { flushNow, useShiftPreflight } from '@/features/sync/preflight';
import { useSession } from '@/hooks/session';
import {
	closePosSession,
	pendingOutboxSummary,
	useOpenPosSession,
	useSettings,
} from '@/repositories';
import { useAppDispatch } from '@/store/hooks';
import * as React from 'react';

export type SignOutResult = { ok: true } | { ok: false; title: string; reason: string };

function queuedReason(): string | null {
	const { count, lastError } = pendingOutboxSummary();
	if (count === 0) return null;
	const what = `${count} transaction${count === 1 ? '' : 's'} still waiting to sync`;
	return lastError
		? `${what} — ${lastError} Stay signed in until ${count === 1 ? 'it reaches' : 'they reach'} the server.`
		: `${what}. Stay signed in until ${count === 1 ? 'it reaches' : 'they reach'} the server.`;
}

export function useGuardedSignOut() {
	const dispatch = useAppDispatch();
	const { signOut } = useSession();
	const openSession = useOpenPosSession();
	const settings = useSettings();
	const preflight = useShiftPreflight();
	const [isClosing, setIsClosing] = React.useState(false);

	const run = React.useCallback(async (): Promise<SignOutResult> => {
		// Sign-out auto-closes an open shift, and that path has no photo to
		// attach — where the photo is mandatory the agent closes properly from
		// reconciliation first.
		if (openSession && settings.requireCloseOutPhoto) {
			return {
				ok: false,
				title: 'Close your session first',
				reason:
					'A close-out photo is required. Close the session from End-of-Day Reconciliation, then sign out.',
			};
		}

		const pre = await preflight.run('sign out');
		if (!pre.ok) return { ok: false, title: 'Cannot sign out', reason: pre.reason };

		if (openSession) {
			setIsClosing(true);
			try {
				const result = closePosSession();
				if (!result.ok) return { ok: false, title: 'Cannot sign out', reason: result.reason };
				try {
					await flushNow(dispatch);
				} catch {
					// fall through to the outbox check — it explains what's stuck
				}
				const stuck = queuedReason();
				if (stuck) {
					return {
						ok: false,
						title: 'Cannot sign out',
						reason: `Your shift was closed but the POS Closing Entry has not reached the server. ${stuck}`,
					};
				}
			} finally {
				setIsClosing(false);
			}
		}

		// Last look: nothing may have been queued between the preflight and now.
		const stuck = queuedReason();
		if (stuck) return { ok: false, title: 'Cannot sign out', reason: stuck };

		await signOut();
		return { ok: true };
	}, [dispatch, openSession, preflight, settings.requireCloseOutPhoto, signOut]);

	return {
		run,
		isRunning: preflight.isRunning || isClosing,
		isOnline: preflight.isOnline,
		hasOpenSession: !!openSession,
	};
}
