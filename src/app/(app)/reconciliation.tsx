import { Screen } from '@/components/domain/Screen';
import { Stat } from '@/components/domain/widgets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { agentStock, conflictCount, pendingCount, transactions } from '@/data/mock';
import { formatKES } from '@/lib/format';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

export default function Reconciliation() {
	const router = useRouter();

	const cashTxns = transactions.filter((t) => t.type === 'cash_payment');
	const cashTotal = cashTxns.reduce((s, t) => s + (t.amount ?? 0), 0);
	const cardTotal = transactions
		.filter((t) => t.type === 'card_withdrawal')
		.reduce((s, t) => s + (t.amount ?? 0), 0);
	const hampersIssued = agentStock.reduce((s, r) => s + r.issuedToday, 0);
	const pending = pendingCount();
	const conflicts = conflictCount();

	const submit = () =>
		Alert.alert('Submit reconciliation', 'Close out the day and submit totals?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Submit',
				onPress: () =>
					Alert.alert('Submitted', 'End-of-day reconciliation queued (dummy).', [
						{ text: 'Done', onPress: () => router.back() },
					]),
			},
		]);

	return (
		<Screen>
			<Text className="text-muted-foreground text-sm">
				Summary of today’s distribution before closing out.
			</Text>

			<Card>
				<CardContent className="gap-4 pt-6">
					<View className="flex-row">
						<Stat label="Cash paid" value={formatKES(cashTotal)} />
						<Stat label="Card withdrawals" value={formatKES(cardTotal)} />
					</View>
					<Separator />
					<View className="flex-row">
						<Stat label="Hampers issued" value={String(hampersIssued)} />
						<Stat label="Transactions" value={String(transactions.length)} />
					</View>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Cash breakdown</CardTitle>
				</CardHeader>
				<CardContent className="gap-2">
					{cashTxns.map((t) => (
						<View key={t.id} className="flex-row justify-between">
							<Text className="text-muted-foreground text-sm">{t.subtitle}</Text>
							<Text className="text-sm font-medium">{formatKES(t.amount)}</Text>
						</View>
					))}
					<Separator />
					<View className="flex-row justify-between">
						<Text className="font-medium">Total cash</Text>
						<Text className="font-semibold">{formatKES(cashTotal)}</Text>
					</View>
				</CardContent>
			</Card>

			{(pending > 0 || conflicts > 0) && (
				<View className="flex-row items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
					<MaterialIcons name="info-outline" size={18} color="#b45309" />
					<Text className="flex-1 text-sm text-amber-700">
						{pending} pending sync{conflicts > 0 ? ` · ${conflicts} need review` : ''}. Sync before
						closing for accurate totals.
					</Text>
				</View>
			)}

			<Button size="lg" onPress={submit}>
				<MaterialIcons name="fact-check" size={20} color="#fff" />
				<Text>Submit reconciliation</Text>
			</Button>
		</Screen>
	);
}
