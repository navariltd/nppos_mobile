import { Screen } from '@/components/domain/Screen';
import { SectionLabel, Stat } from '@/components/domain/widgets';
import { Alert as AlertBanner, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { useOnline } from '@/hooks/online';
import { useActivePosProfile } from '@/hooks/pos-profile';
import { formatKES, formatTime } from '@/lib/format';
import { syncNow } from '@/features/sync/engine';
import {
	closePosSession,
	useAgentStock,
	useOpenPosSession,
	useSessionCashTotal,
	useSyncCounts,
	useTransactions,
} from '@/repositories';
import { useAppDispatch } from '@/store/hooks';
import { useRouter } from 'expo-router';
import { ClipboardCheck, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function Reconciliation() {
	const router = useRouter();
	const dispatch = useAppDispatch();

	const transactions = useTransactions();
	const profile = useActivePosProfile();
	const agentStock = useAgentStock(profile?.warehouse);
	const { pending, conflicts } = useSyncCounts();
	const session = useOpenPosSession();
	const sessionCash = useSessionCashTotal(session?.id);
	const { isOnline } = useOnline();
	const [counted, setCounted] = React.useState('');

	const expectedCash = session ? session.openingFloat - sessionCash : 0;

	// Closing a session is the reconcile moment: record the closing entry, then
	// flush the outbox right away if we're online (docs/NPPOS_WEB.md §policy).
	const submitClose = async () => {
		if (!session) return;
		const result = closePosSession(Number(counted) || 0);
		if (!result.ok) {
			Alert.alert('Could not close', result.reason);
			return;
		}
		if (isOnline) {
			try {
				const r = await dispatch(syncNow()).unwrap();
				Alert.alert(
					'Session closed & synced',
					`POS Closing Entry submitted — ${r.pushed} item${r.pushed === 1 ? '' : 's'} synced${r.conflicts ? `, ${r.conflicts} need review` : ''}.`,
					[{ text: 'Done', onPress: () => router.back() }],
				);
			} catch {
				Alert.alert(
					'Session closed',
					'Sync did not finish — everything is queued and will retry automatically.',
					[{ text: 'Done', onPress: () => router.back() }],
				);
			}
		} else {
			Alert.alert(
				'Session closed',
				'Offline — the POS Closing Entry is queued and will sync when you reconnect.',
				[{ text: 'Done', onPress: () => router.back() }],
			);
		}
	};

	const cashTxns = transactions.filter((t) => t.type === 'cash_payment');
	const cashTotal = cashTxns.reduce((s, t) => s + (t.amount ?? 0), 0);
	const hampersIssued = agentStock.reduce((s, r) => s + r.issuedToday, 0);

	return (
		<Screen>
			<Text className="text-muted-foreground text-sm">
				Summary of today's distribution before closing out.
			</Text>

			<Animated.View entering={FadeInDown.duration(300)}>
				<Card className="bg-primary border-primary">
					<CardContent className="gap-4 pt-5">
						<View className="flex-row">
							<Stat
								label="Cash paid"
								value={formatKES(cashTotal)}
								valueClassName="text-primary-foreground"
								labelClassName="text-primary-foreground/60"
							/>
							<Stat
								label="Cash payouts"
								value={String(cashTxns.length)}
								valueClassName="text-primary-foreground"
								labelClassName="text-primary-foreground/60"
							/>
						</View>
						<Separator className="bg-white/15" />
						<View className="flex-row">
							<Stat
								label="Hampers issued"
								value={String(hampersIssued)}
								valueClassName="text-primary-foreground"
								labelClassName="text-primary-foreground/60"
							/>
							<Stat
								label="Transactions"
								value={String(transactions.length)}
								valueClassName="text-primary-foreground"
								labelClassName="text-primary-foreground/60"
							/>
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			<SectionLabel>Cash breakdown</SectionLabel>
			<Animated.View entering={FadeInDown.duration(300).delay(80)}>
				<Card>
					<CardContent className="gap-2.5 pt-5">
						{cashTxns.map((t) => (
							<View key={t.id} className="flex-row justify-between">
								<Text className="text-muted-foreground flex-1 text-sm" numberOfLines={1}>
									{t.subtitle}
								</Text>
								<Text className="font-display-medium text-sm">{formatKES(t.amount)}</Text>
							</View>
						))}
						<Separator className="my-1" />
						<View className="flex-row justify-between">
							<Text className="font-medium">Total cash</Text>
							<Text className="font-display-semibold">{formatKES(cashTotal)}</Text>
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			{(pending > 0 || conflicts > 0) && (
				<Animated.View entering={FadeInDown.duration(300).delay(140)}>
					<AlertBanner icon={TriangleAlert} className="border-warning/40 bg-warning/10">
						<AlertTitle className="text-warning">Unsynced work</AlertTitle>
						<AlertDescription className="text-warning">
							{pending} pending sync{conflicts > 0 ? ` · ${conflicts} need review` : ''}. Sync
							before closing for accurate totals.
						</AlertDescription>
					</AlertBanner>
				</Animated.View>
			)}

			{/* Session close-out — becomes the POS Closing Entry */}
			{session ? (
				<>
					<SectionLabel>POS session</SectionLabel>
					<Animated.View entering={FadeInDown.duration(300).delay(180)}>
						<Card>
							<CardContent className="gap-2.5 pt-5">
								<View className="flex-row justify-between">
									<Text className="text-muted-foreground text-sm">Opened</Text>
									<Text className="text-sm font-medium">{formatTime(session.openedAt)}</Text>
								</View>
								<View className="flex-row justify-between">
									<Text className="text-muted-foreground text-sm">Opening float</Text>
									<Text className="text-sm font-medium">{formatKES(session.openingFloat)}</Text>
								</View>
								<View className="flex-row justify-between">
									<Text className="text-muted-foreground text-sm">Cash paid out this session</Text>
									<Text className="text-sm font-medium">{formatKES(sessionCash)}</Text>
								</View>
								<Separator className="my-1" />
								<View className="flex-row justify-between">
									<Text className="font-medium">Expected cash in hand</Text>
									<Text className="font-display-semibold">{formatKES(expectedCash)}</Text>
								</View>
							</CardContent>
						</Card>
					</Animated.View>

					<Animated.View entering={FadeInDown.duration(300).delay(240)}>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button size="lg">
									<Icon as={ClipboardCheck} size={20} className="text-primary-foreground" />
									<Text>Close session & submit</Text>
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Close POS session</AlertDialogTitle>
									<AlertDialogDescription>
										Expected cash in hand is {formatKES(expectedCash)} (float{' '}
										{formatKES(session.openingFloat)} − payouts {formatKES(sessionCash)}). Count
										your cash and enter the actual amount.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<View className="gap-1.5">
									<Text className="text-muted-foreground text-xs">Counted cash (KES)</Text>
									<Input
										value={counted}
										onChangeText={setCounted}
										keyboardType="number-pad"
										placeholder={String(expectedCash)}
										className="h-12 rounded-xl"
									/>
								</View>
								<AlertDialogFooter>
									<AlertDialogCancel>
										<Text>Cancel</Text>
									</AlertDialogCancel>
									<AlertDialogAction onPress={submitClose}>
										<Text>Close session</Text>
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</Animated.View>
				</>
			) : (
				<Animated.View entering={FadeInDown.duration(300).delay(200)}>
					<AlertBanner icon={TriangleAlert} className="border-info/30 bg-info/10">
						<AlertTitle className="text-info">No open POS session</AlertTitle>
						<AlertDescription className="text-info">
							Nothing to close right now. Open a session from the dashboard to start a shift.
						</AlertDescription>
					</AlertBanner>
				</Animated.View>
			)}
		</Screen>
	);
}
