// Shift control on the dashboard. Issuing (cash/goods/card) is blocked until a
// session is open; closing happens on the reconciliation screen. Maps to
// ERPNext POS Opening/Closing Entries — see docs/FRAPPE_BACKEND.md.
//
// Opening a shift is ONLINE-ONLY (see features/sync/preflight.ts): the device
// first flushes anything left over and pulls fresh vouchers/stock, then creates
// the session and pushes it straight away, so the POS Opening Entry exists
// server-side before the first redemption references it.

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { flushNow, useShiftPreflight } from '@/features/sync/preflight';
import { useCurrency } from '@/hooks/currency';
import { useActivePosProfile } from '@/hooks/pos-profile';
import { formatTime } from '@/lib/format';
import {
	discardUnsyncedPosSession,
	openPosSession,
	posSessionServerName,
	useOpenPosSession,
	useSessionCashTotal,
} from '@/repositories';
import { useAppDispatch } from '@/store/hooks';
import { useRouter } from 'expo-router';
import { CloudOff, PlayCircle, StopCircle } from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';

export function PosSessionCard() {
	const router = useRouter();
	const dispatch = useAppDispatch();
	const profile = useActivePosProfile();
	const { format, symbol } = useCurrency();
	const session = useOpenPosSession();
	const cashPaid = useSessionCashTotal(session?.id);
	const preflight = useShiftPreflight();
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [float, setFloat] = React.useState('');

	const open = async () => {
		if (!profile) {
			Alert.alert('Could not open session', 'No active POS profile.');
			return;
		}
		setDialogOpen(false);

		// Level with the backend first — nothing queued, everything pulled.
		const pre = await preflight.run('open a POS session');
		if (!pre.ok) {
			Alert.alert('Cannot open session', pre.reason);
			return;
		}

		const result = openPosSession(Number(float) || 0, profile.id);
		if (!result.ok) {
			Alert.alert('Could not open session', result.reason);
			return;
		}
		setFloat('');

		// Push the opening immediately: everything issued during the shift
		// references the POS Opening Entry by its server name.
		try {
			await flushNow(dispatch);
		} catch {
			// fall through to the server-name check below
		}
		// No entry on the server = no shift. Roll the local session back rather
		// than run a shift whose redemptions can't be attributed to a POS Opening
		// Entry — they'd never appear on its closing entry.
		if (!posSessionServerName(result.transactionId)) {
			discardUnsyncedPosSession(result.transactionId);
			Alert.alert(
				'Session not opened',
				'The POS Opening Entry did not reach the server, so the shift was not started. Check your connection and try again.',
			);
		}
	};

	if (session) {
		return (
			<Card className="border-success/40">
				<CardContent className="flex-row items-center gap-3 py-4">
					<View className="bg-success/10 h-10 w-10 items-center justify-center rounded-xl">
						<Icon
							as={PlayCircle}
							size={18}
							className="text-success"
						/>
					</View>
					<View className="flex-1">
						<Text className="font-medium">
							Session open · since {formatTime(session.openedAt)}
						</Text>
						<Text className="text-muted-foreground text-xs">
							Float {format(session.openingFloat)} · paid out{' '}
							{format(cashPaid)}
						</Text>
					</View>
					<Button
						variant="outline"
						size="sm"
						onPress={() => router.push('/reconciliation')}
					>
						<Icon
							as={StopCircle}
							size={15}
							className="text-destructive"
						/>
						<Text>Close</Text>
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card className="border-warning/40 bg-warning/5">
				<CardContent className="flex-row items-center gap-3 py-4">
					<View className="bg-warning/15 h-10 w-10 items-center justify-center rounded-xl">
						<Icon
							as={StopCircle}
							size={18}
							className="text-warning"
						/>
					</View>
					<View className="flex-1">
						<Text className="font-medium">No open POS session</Text>
						<Text className="text-muted-foreground text-xs">
							{preflight.isRunning
								? 'Syncing before opening…'
								: preflight.isOnline
									? `Open one to start issuing · ${profile?.name ?? 'no profile'}`
									: 'Go online to open a shift'}
						</Text>
					</View>
					<Button
						size="sm"
						disabled={!preflight.isOnline || preflight.isRunning}
						onPress={() => setDialogOpen(true)}
					>
						<Icon
							as={preflight.isOnline ? PlayCircle : CloudOff}
							size={15}
							className="text-primary-foreground"
						/>
						<Text>{preflight.isRunning ? 'Working…' : 'Open'}</Text>
					</Button>
				</CardContent>
			</Card>

			<AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Open POS session</AlertDialogTitle>
						<AlertDialogDescription>
							Count the cash float you are starting the shift
							with. Opening syncs first — anything still queued is
							sent and today's vouchers and stock are pulled —
							then submits the POS Opening Entry.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<View className="gap-1.5">
						<Text className="text-muted-foreground text-xs">
							Opening cash float ({symbol})
						</Text>
						<Input
							value={float}
							onChangeText={setFloat}
							keyboardType="number-pad"
							placeholder="0"
							className="h-12 rounded-xl"
						/>
					</View>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Text>Cancel</Text>
						</AlertDialogCancel>
						<AlertDialogAction onPress={open}>
							<Text>Open session</Text>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
