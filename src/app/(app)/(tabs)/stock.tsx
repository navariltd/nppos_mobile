import { Screen } from '@/components/domain/Screen';
import { Stat } from '@/components/domain/widgets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { agentStock, currentAgent } from '@/data/mock';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Alert, View } from 'react-native';

export default function Stock() {
	const totalOnHand = agentStock.reduce((s, r) => s + r.onHand, 0);
	const totalIssued = agentStock.reduce((s, r) => s + r.issuedToday, 0);
	const totalDamaged = agentStock.reduce((s, r) => s + r.damaged, 0);

	const notImplemented = (what: string) =>
		Alert.alert(what, 'Not wired up yet — dummy data build.');

	return (
		<Screen edges={['top']}>
			<View>
				<Text variant="h3">Stock</Text>
				<Text className="text-muted-foreground text-sm">
					{currentAgent.code} · agent warehouse
				</Text>
			</View>

			<Card>
				<CardContent className="flex-row pt-6">
					<Stat label="On hand" value={String(totalOnHand)} />
					<Stat label="Issued today" value={String(totalIssued)} />
					<Stat label="Damaged" value={String(totalDamaged)} />
				</CardContent>
			</Card>

			{agentStock.map((row) => (
				<Card key={row.hamperId}>
					<CardHeader>
						<View className="flex-row items-center justify-between">
							<CardTitle>{row.hamperName}</CardTitle>
							<View className="bg-muted rounded-md px-2 py-1">
								<Text className="text-xs font-medium">{row.hamperId}</Text>
							</View>
						</View>
					</CardHeader>
					<CardContent className="gap-3">
						<View className="flex-row">
							<Stat label="On hand" value={String(row.onHand)} />
							<Stat label="Issued" value={String(row.issuedToday)} />
							<Stat label="Damaged" value={String(row.damaged)} />
						</View>
						<Separator />
						<View className="flex-row gap-2">
							<Button
								variant="outline"
								size="sm"
								className="flex-1"
								onPress={() => notImplemented('Return stock')}
							>
								<MaterialIcons name="undo" size={16} color="#0f172a" />
								<Text>Return</Text>
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="flex-1"
								onPress={() => notImplemented('Report damaged / expired')}
							>
								<MaterialIcons name="report-gmailerrorred" size={16} color="#0f172a" />
								<Text>Damaged</Text>
							</Button>
						</View>
					</CardContent>
				</Card>
			))}
		</Screen>
	);
}
