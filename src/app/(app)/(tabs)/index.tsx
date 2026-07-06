import { SyncStatusPill } from '@/components/domain/SyncStatusPill';
import { Screen } from '@/components/domain/Screen';
import { ActionTile, Stat } from '@/components/domain/widgets';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
	agentStock,
	conflictCount,
	currentAgent,
	disbursementOrders,
	pendingCount,
} from '@/data/mock';
import { useOnline } from '@/hooks/online';
import { useSession } from '@/hooks/session';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

export default function Dashboard() {
	const router = useRouter();
	const { isOnline } = useOnline();
	const { role } = useSession();
	const conflicts = conflictCount();
	const pending = pendingCount();

	const primaryDO = disbursementOrders[0];
	const progress = Math.round((primaryDO.issuedCount / primaryDO.totalBeneficiaries) * 100);
	const issuedToday = agentStock.reduce((sum, s) => sum + s.issuedToday, 0);

	return (
		<Screen edges={['top']}>
			{/* Header */}
			<View className="flex-row items-start justify-between">
				<View>
					<Text className="text-muted-foreground text-sm">Welcome back</Text>
					<Text variant="h3">{currentAgent.name}</Text>
					<Text className="text-muted-foreground text-xs">{currentAgent.region}</Text>
				</View>
				<SyncStatusPill />
			</View>

			{/* Needs-review banner */}
			{conflicts > 0 && (
				<Pressable onPress={() => router.push('/transactions')}>
					<View className="flex-row items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5">
						<MaterialIcons name="error-outline" size={18} color="#b91c1c" />
						<Text className="flex-1 text-sm text-red-700">
							{conflicts} transaction{conflicts > 1 ? 's' : ''} need review
						</Text>
						<MaterialIcons name="chevron-right" size={18} color="#b91c1c" />
					</View>
				</Pressable>
			)}

			{/* DO progress */}
			<Card>
				<CardContent className="gap-3 pt-6">
					<View className="flex-row items-center justify-between">
						<Text className="font-medium">{primaryDO.name}</Text>
						<Text className="text-muted-foreground text-sm">{progress}%</Text>
					</View>
					<View className="bg-muted h-2 overflow-hidden rounded-full">
						<View className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
					</View>
					<View className="flex-row">
						<Stat label="Issued" value={String(primaryDO.issuedCount)} />
						<Stat label="Target" value={String(primaryDO.totalBeneficiaries)} />
						<Stat label="Today" value={String(issuedToday)} />
					</View>
				</CardContent>
			</Card>

			{/* Action hub */}
			<Text className="mt-1 font-semibold">Distribute</Text>
			<View className="gap-3">
				<View className="flex-row gap-3">
					<ActionTile
						icon="local-atm"
						label="Cash Vouchers"
						sublabel="Search & issue"
						tint="#0f766e"
						onPress={() => router.push('/vouchers')}
					/>
					<ActionTile
						icon="redeem"
						label="Goods / Hampers"
						sublabel="Issue to beneficiary"
						tint="#b45309"
						onPress={() => router.push('/goods')}
					/>
				</View>
				<View className="flex-row gap-3">
					<ActionTile
						icon="credit-card"
						label="ATM / Bank Card"
						sublabel={isOnline ? 'Online withdrawal' : 'Offline — unavailable'}
						tint="#1d4ed8"
						disabled={!isOnline}
						onPress={() => router.push('/card')}
					/>
					<ActionTile
						icon="fact-check"
						label="Reconcile"
						sublabel="End of day"
						tint="#6d28d9"
						onPress={() => router.push('/reconciliation')}
					/>
				</View>
			</View>

			{/* Pending sync note */}
			<Card>
				<CardContent className="flex-row items-center gap-3 py-4">
					<MaterialIcons name="sync" size={20} color="#71717a" />
					<View className="flex-1">
						<Text className="text-sm font-medium">
							{pending > 0 ? `${pending} pending sync` : 'All synced'}
						</Text>
						<Text className="text-muted-foreground text-xs">
							{isOnline ? 'Syncing in background' : 'Will sync when back online'}
						</Text>
					</View>
					<Pressable onPress={() => router.push('/transactions')}>
						<Text className="text-primary text-sm font-medium">View</Text>
					</Pressable>
				</CardContent>
			</Card>

			{role === 'admin' && (
				<>
					<Separator />
					<Pressable onPress={() => router.push('/admin')}>
						<Card>
							<CardContent className="flex-row items-center gap-3 py-4">
								<MaterialIcons name="admin-panel-settings" size={22} color="#0f172a" />
								<View className="flex-1">
									<Text className="font-medium">Admin oversight</Text>
									<Text className="text-muted-foreground text-xs">
										Agents progress · DO summaries · reports
									</Text>
								</View>
								<MaterialIcons name="chevron-right" size={22} color="#a1a1aa" />
							</CardContent>
						</Card>
					</Pressable>
				</>
			)}
		</Screen>
	);
}
