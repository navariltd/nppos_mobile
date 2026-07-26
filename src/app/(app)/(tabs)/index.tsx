import { PosSessionCard } from '@/components/domain/PosSessionCard';
import { SyncStatusPill } from '@/components/domain/SyncStatusPill';
import { ActionTile, ListRow, SectionLabel } from '@/components/domain/widgets';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/hooks/session';
import { useActivePosProfile } from '@/hooks/pos-profile';
import { useSyncCounts } from '@/repositories';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
	ChevronRight,
	CircleAlert,
	ClipboardCheck,
	CreditCard,
	RefreshCw,
	Search,
	ShieldCheck,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Dashboard() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const isFocused = useIsFocused();
	const { role, agent } = useSession();
	const profile = useActivePosProfile();
	const { pending, conflicts } = useSyncCounts();

	// Real logged-in identity (not mock). region/code can be blank on the real
	// backend — fall back to the active POS profile's warehouse.
	const subtitle = [agent?.code || profile?.warehouse, agent?.region]
		.filter(Boolean)
		.join(' · ');

	return (
		<View className="bg-background flex-1">
			{isFocused && <StatusBar style="light" />}
			<ScrollView contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
				{/* Evergreen canopy header */}
				<View
					className="bg-primary rounded-b-[28px] px-5 pb-6"
					style={{ paddingTop: insets.top + 16 }}
				>
					<View className="flex-row items-start justify-between">
						<View className="flex-1 pr-3">
							<Text className="text-primary-foreground/70 text-sm">Welcome back</Text>
							<Text className="text-primary-foreground font-display text-2xl" numberOfLines={1}>
								{agent?.name || 'Agent'}
							</Text>
							{subtitle ? (
								<Text className="text-primary-foreground/60 mt-0.5 text-xs" numberOfLines={1}>
									{subtitle}
								</Text>
							) : null}
						</View>
						<SyncStatusPill onDark />
					</View>
				</View>

				{/* Content sits below the canopy */}
				<View className="mt-4 gap-4 px-4">
					{/* Shift control — redeeming is gated on an open session */}
					<Animated.View entering={FadeInDown.duration(350)}>
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

					{/* Primary action — search a voucher (cash or goods) */}
					<Animated.View entering={FadeInDown.duration(350).delay(90)}>
						<Pressable
							onPress={() => router.push('/search')}
							className="bg-primary flex-row items-center gap-3 rounded-2xl px-5 py-5 active:opacity-90"
						>
							<View className="bg-primary-foreground/15 h-11 w-11 items-center justify-center rounded-xl">
								<Icon as={Search} size={22} className="text-primary-foreground" />
							</View>
							<View className="flex-1">
								<Text className="text-primary-foreground font-display-semibold text-base">
									Search voucher
								</Text>
								<Text className="text-primary-foreground/70 text-xs">
									By voucher no or beneficiary no · cash or hamper
								</Text>
							</View>
							<Icon as={ChevronRight} size={20} className="text-primary-foreground/80" />
						</Pressable>
					</Animated.View>

					{/* Secondary actions */}
					<Animated.View entering={FadeInDown.duration(350).delay(120)} className="gap-3">
						<SectionLabel>More</SectionLabel>
						<View className="flex-row gap-3">
							<ActionTile
								icon={ClipboardCheck}
								label="Reconcile"
								sublabel="End of day"
								className="bg-accent"
								iconClassName="text-accent-foreground"
								onPress={() => router.push('/reconciliation')}
							/>
							<ActionTile
								icon={CreditCard}
								label="ATM / Bank Card"
								sublabel="Coming soon"
								className="bg-info/10"
								iconClassName="text-info"
								onPress={() => router.push('/card')}
							/>
						</View>
					</Animated.View>

					{/* Sync + admin */}
					<Animated.View entering={FadeInDown.duration(350).delay(180)} className="gap-4">
						<Card className="overflow-hidden py-0">
							<ListRow
								title={pending > 0 ? `${pending} pending sync` : 'All synced'}
								subtitle="View your transactions"
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
									subtitle="Agents progress · summaries · reports"
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
