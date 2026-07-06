import { Screen } from '@/components/domain/Screen';
import { ListRow, Stat } from '@/components/domain/widgets';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { agentsOverview, disbursementOrders } from '@/data/mock';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

export default function AdminHome() {
	const router = useRouter();
	const totalIssued = agentsOverview.reduce((s, a) => s + a.issued, 0);
	const totalTarget = agentsOverview.reduce((s, a) => s + a.target, 0);
	const openDOs = disbursementOrders.filter((d) => d.status === 'open').length;

	return (
		<Screen>
			<Card>
				<CardContent className="flex-row pt-6">
					<Stat label="Agents" value={String(agentsOverview.length)} />
					<Stat label="Issued" value={String(totalIssued)} />
					<Stat label="Target" value={String(totalTarget)} />
					<Stat label="Open DOs" value={String(openDOs)} />
				</CardContent>
			</Card>

			<Card className="overflow-hidden py-0">
				<ListRow
					title="Agents overview"
					subtitle="Progress per agent"
					onPress={() => router.push('/admin/agents')}
					leading={<MaterialIcons name="groups" size={22} color="#0f172a" />}
				/>
				<Separator />
				<ListRow
					title="Disbursement orders"
					subtitle="DO summaries"
					onPress={() => router.push('/admin/orders')}
					leading={<MaterialIcons name="assignment" size={22} color="#0f172a" />}
				/>
				<Separator />
				<ListRow
					title="Reports"
					subtitle="Exports & analytics"
					onPress={() => Alert.alert('Reports', 'Not wired up yet — dummy data build.')}
					leading={<MaterialIcons name="insert-chart-outlined" size={22} color="#0f172a" />}
				/>
			</Card>

			<View className="flex-row items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5">
				<MaterialIcons name="admin-panel-settings" size={18} color="#1d4ed8" />
				<Text className="flex-1 text-sm text-blue-700">
					Admins share the agent baseline UI plus this oversight stack.
				</Text>
			</View>
		</Screen>
	);
}
