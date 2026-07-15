import { Screen } from '@/components/domain/Screen';
import { ListRow, Stat } from '@/components/domain/widgets';
import { Alert as AlertBanner, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { agentsOverview, disbursementOrders } from '@/data/mock';
import { useRouter } from 'expo-router';
import { ChartColumn, ClipboardList, ShieldCheck, UsersRound } from 'lucide-react-native';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function AdminHome() {
	const router = useRouter();
	const totalIssued = agentsOverview.reduce((s, a) => s + a.issued, 0);
	const totalTarget = agentsOverview.reduce((s, a) => s + a.target, 0);
	const openDOs = disbursementOrders.filter((d) => d.status === 'open').length;

	return (
		<Screen>
			<Animated.View entering={FadeInDown.duration(300)}>
				<Card className="bg-primary border-primary">
					<CardContent className="flex-row pt-5">
						<Stat
							label="Agents"
							value={String(agentsOverview.length)}
							valueClassName="text-primary-foreground"
							labelClassName="text-primary-foreground/60"
						/>
						<Stat
							label="Issued"
							value={String(totalIssued)}
							valueClassName="text-primary-foreground"
							labelClassName="text-primary-foreground/60"
						/>
						<Stat
							label="Target"
							value={String(totalTarget)}
							valueClassName="text-primary-foreground"
							labelClassName="text-primary-foreground/60"
						/>
						<Stat
							label="Open DOs"
							value={String(openDOs)}
							valueClassName="text-primary-foreground"
							labelClassName="text-primary-foreground/60"
						/>
					</CardContent>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(80)}>
				<Card className="overflow-hidden py-0">
					<ListRow
						title="Agents overview"
						subtitle="Progress per agent"
						onPress={() => router.push('/admin/agents')}
						leading={
							<View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-xl">
								<Icon as={UsersRound} size={18} className="text-primary" />
							</View>
						}
					/>
					<Separator />
					<ListRow
						title="Disbursement orders"
						subtitle="DO summaries"
						onPress={() => router.push('/admin/orders')}
						leading={
							<View className="bg-warning/15 h-10 w-10 items-center justify-center rounded-xl">
								<Icon as={ClipboardList} size={18} className="text-warning" />
							</View>
						}
					/>
					<Separator />
					<ListRow
						title="Reports"
						subtitle="Exports & analytics"
						onPress={() => Alert.alert('Reports', 'Not wired up yet — dummy data build.')}
						leading={
							<View className="bg-info/10 h-10 w-10 items-center justify-center rounded-xl">
								<Icon as={ChartColumn} size={18} className="text-info" />
							</View>
						}
					/>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(160)}>
				<AlertBanner icon={ShieldCheck} className="border-info/30 bg-info/10">
					<AlertTitle className="text-info">Oversight view</AlertTitle>
					<AlertDescription className="text-info">
						Admins share the agent baseline UI plus this oversight stack.
					</AlertDescription>
				</AlertBanner>
			</Animated.View>
		</Screen>
	);
}
