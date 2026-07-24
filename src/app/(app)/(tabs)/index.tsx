import { PosSessionCard } from '@/components/domain/PosSessionCard';
import { SyncStatusPill } from '@/components/domain/SyncStatusPill';
import { ActionTile, ListRow, SectionLabel, Stat } from '@/components/domain/widgets';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { currentAgent } from '@/data/mock';
import { useOnline } from '@/hooks/online';
import { useSession } from '@/hooks/session';
import { useActivePosProfile } from '@/hooks/pos-profile';
import { useAgentStock, useDisbursementOrders, useSyncCounts } from '@/repositories';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
	Banknote,
	ChevronRight,
	CircleAlert,
	ClipboardCheck,
	CreditCard,
	Gift,
	RefreshCw,
	ShieldCheck,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Dashboard() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const isFocused = useIsFocused();
	const { isOnline } = useOnline();
	const { role } = useSession();
	const { pending, conflicts } = useSyncCounts();
	const disbursementOrders = useDisbursementOrders();
	const profile = useActivePosProfile();
	const agentStock = useAgentStock(profile?.warehouse);

	const primaryDO = disbursementOrders[0];
	const progress = primaryDO
		? Math.round((primaryDO.issuedCount / primaryDO.totalBeneficiaries) * 100)
		: 0;
	const issuedToday = agentStock.reduce((sum, s) => sum + s.issuedToday, 0);

	return (
		<View className="bg-background flex-1">
			{isFocused && <StatusBar style="light" />}
			<ScrollView contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
				{/* Evergreen canopy header */}
				<View
					className="bg-primary rounded-b-[28px] px-5 pb-16"
					style={{ paddingTop: insets.top + 16 }}
				>
					<View className="flex-row items-start justify-between">
						<View>
							<Text className="text-primary-foreground/70 text-sm">Welcome back</Text>
							<Text className="text-primary-foreground font-display text-2xl">
								{currentAgent.name}
							</Text>
							<Text className="text-primary-foreground/60 mt-0.5 text-xs">
								{currentAgent.code} · {currentAgent.region}
							</Text>
						</View>
						<SyncStatusPill onDark />
					</View>
				</View>

				{/* Content overlaps the canopy */}
				<View className="-mt-12 gap-4 px-4">
					{/* Today's DO progress */}
					{primaryDO && (
					<Animated.View entering={FadeInDown.duration(350)}>
						<Card className="shadow-md shadow-black/10">
							<CardContent className="gap-4 pt-5">
								<View className="flex-row items-center justify-between">
									<Text className="flex-1 font-medium" numberOfLines={1}>
										{primaryDO.name}
									</Text>
									<Text className="font-display text-primary text-lg">{progress}%</Text>
								</View>
								<Progress value={progress} indicatorClassName="bg-primary" />
								<View className="flex-row">
									<Stat label="Issued" value={String(primaryDO.issuedCount)} />
									<Stat label="Target" value={String(primaryDO.totalBeneficiaries)} />
									<Stat label="Today" value={String(issuedToday)} />
								</View>
							</CardContent>
						</Card>
					</Animated.View>
					)}

					{/* Shift control — issuing is gated on an open session */}
					<Animated.View entering={FadeInDown.duration(350).delay(30)}>
						<PosSessionCard />
					</Animated.View>

					{/* Needs-review banner */}
					{conflicts > 0 && (
						<Animated.View entering={FadeInDown.duration(350).delay(60)}>
							<Pressable
								onPress={() => router.push('/transactions')}
								className="bg-destructive/10 flex-row items-center gap-2.5 rounded-xl px-4 py-3 active:opacity-70"
							>
								<Icon as={CircleAlert} size={18} className="text-destructive" />
								<Text className="text-destructive flex-1 text-sm font-medium">
									{conflicts} transaction{conflicts > 1 ? 's' : ''} need review
								</Text>
								<Icon as={ChevronRight} size={18} className="text-destructive" />
							</Pressable>
						</Animated.View>
					)}

					{/* Action hub */}
					<Animated.View entering={FadeInDown.duration(350).delay(120)} className="gap-3">
						<SectionLabel>Distribute</SectionLabel>
						<View className="flex-row gap-3">
							<ActionTile
								icon={Banknote}
								label="Cash Vouchers"
								sublabel="Search & issue"
								className="bg-primary/10"
								iconClassName="text-primary"
								onPress={() => router.push('/vouchers')}
							/>
							<ActionTile
								icon={Gift}
								label="Goods / Hampers"
								sublabel="Issue to beneficiary"
								className="bg-warning/15"
								iconClassName="text-warning"
								onPress={() => router.push('/goods')}
							/>
						</View>
						<View className="flex-row gap-3">
							<ActionTile
								icon={CreditCard}
								label="ATM / Bank Card"
								sublabel={isOnline ? 'Online withdrawal' : 'Offline — unavailable'}
								className="bg-info/10"
								iconClassName="text-info"
								disabled={!isOnline}
								onPress={() => router.push('/card')}
							/>
							<ActionTile
								icon={ClipboardCheck}
								label="Reconcile"
								sublabel="End of day"
								className="bg-accent"
								iconClassName="text-accent-foreground"
								onPress={() => router.push('/reconciliation')}
							/>
						</View>
					</Animated.View>

					{/* Sync + admin */}
					<Animated.View entering={FadeInDown.duration(350).delay(180)} className="gap-4">
						<Card className="overflow-hidden py-0">
							<ListRow
								title={pending > 0 ? `${pending} pending sync` : 'All synced'}
								subtitle={isOnline ? 'Syncing in background' : 'Will sync when back online'}
								onPress={() => router.push('/transactions')}
								leading={
									<View className="bg-warning/15 h-10 w-10 items-center justify-center rounded-xl">
										<Icon as={RefreshCw} size={18} className="text-warning" />
									</View>
								}
							/>
						</Card>

						{role === 'admin' && (
							<Card className="overflow-hidden py-0">
								<ListRow
									title="Admin oversight"
									subtitle="Agents progress · DO summaries · reports"
									onPress={() => router.push('/admin')}
									leading={
										<View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-xl">
											<Icon as={ShieldCheck} size={18} className="text-primary" />
										</View>
									}
								/>
							</Card>
						)}
					</Animated.View>
				</View>
			</ScrollView>
		</View>
	);
}
