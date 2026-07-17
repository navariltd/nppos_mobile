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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatKES } from '@/lib/format';
import { useAgentStock, useSyncCounts, useTransactions } from '@/repositories';
import { useRouter } from 'expo-router';
import { ClipboardCheck, TriangleAlert } from 'lucide-react-native';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function Reconciliation() {
	const router = useRouter();

	const transactions = useTransactions();
	const agentStock = useAgentStock();
	const { pending, conflicts } = useSyncCounts();

	const cashTxns = transactions.filter((t) => t.type === 'cash_payment');
	const cashTotal = cashTxns.reduce((s, t) => s + (t.amount ?? 0), 0);
	const cardTotal = transactions
		.filter((t) => t.type === 'card_withdrawal')
		.reduce((s, t) => s + (t.amount ?? 0), 0);
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
								label="Card withdrawals"
								value={formatKES(cardTotal)}
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

			<Animated.View entering={FadeInDown.duration(300).delay(200)}>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button size="lg">
							<Icon as={ClipboardCheck} size={20} className="text-primary-foreground" />
							<Text>Submit reconciliation</Text>
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Submit reconciliation</AlertDialogTitle>
							<AlertDialogDescription>
								Close out the day and submit totals? {formatKES(cashTotal)} cash ·{' '}
								{hampersIssued} hampers · {formatKES(cardTotal)} card.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>
								<Text>Cancel</Text>
							</AlertDialogCancel>
							<AlertDialogAction
								onPress={() =>
									Alert.alert('Submitted', 'End-of-day reconciliation queued (dummy).', [
										{ text: 'Done', onPress: () => router.back() },
									])
								}
							>
								<Text>Submit</Text>
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</Animated.View>
		</Screen>
	);
}
