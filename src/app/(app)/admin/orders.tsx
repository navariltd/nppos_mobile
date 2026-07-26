import { Screen } from '@/components/domain/Screen';
import { EmptyState, Stat } from '@/components/domain/widgets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatKES } from '@/lib/format';
import { useAssignments } from '@/repositories';
import { ClipboardList } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// Agent Disbursement Assignments (ADA) — the agent-scoped slices. Projects/DOs
// are back-office refs carried as name strings; the ADA is what reaches the app.
export default function Assignments() {
	const assignments = useAssignments();
	if (assignments.length === 0) {
		return (
			<Screen>
				<EmptyState icon={ClipboardList} title="No assignments" subtitle="Nothing pulled yet." />
			</Screen>
		);
	}
	return (
		<Screen>
			{assignments.map((a, i) => (
				<Animated.View key={a.id} entering={FadeInDown.duration(300).delay(i * 60)}>
					<Card>
						<CardHeader>
							<CardTitle numberOfLines={2}>{a.project}</CardTitle>
							<Text className="text-muted-foreground text-sm">
								{a.disbursementOrder ?? '—'}
								{a.date ? ` · ${a.date}` : ''}
							</Text>
						</CardHeader>
						<CardContent className="gap-3">
							<View className="flex-row">
								<Stat label="To disburse" value={formatKES(a.amountToDisburse)} />
								<Stat label="Agent" value={a.agentId} />
							</View>
						</CardContent>
					</Card>
				</Animated.View>
			))}
		</Screen>
	);
}
