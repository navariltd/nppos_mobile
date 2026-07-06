import { Screen } from '@/components/domain/Screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { agentsOverview } from '@/data/mock';
import { View } from 'react-native';

export default function AgentsOverview() {
	return (
		<Screen>
			{agentsOverview.map((a) => {
				const pct = Math.round((a.issued / a.target) * 100);
				return (
					<Card key={a.id}>
						<CardContent className="gap-3 pt-6">
							<View className="flex-row items-start justify-between">
								<View>
									<Text className="font-semibold">{a.name}</Text>
									<Text className="text-muted-foreground text-xs">
										{a.code} · {a.region}
									</Text>
								</View>
								{a.pending > 0 && (
									<View className="rounded-full bg-amber-100 px-2 py-0.5">
										<Text className="text-xs font-medium text-amber-700">
											{a.pending} pending
										</Text>
									</View>
								)}
							</View>
							<View className="bg-muted h-2 overflow-hidden rounded-full">
								<View
									className="bg-primary h-full rounded-full"
									style={{ width: `${Math.min(pct, 100)}%` }}
								/>
							</View>
							<View className="flex-row justify-between">
								<Text className="text-muted-foreground text-xs">
									{a.issued} / {a.target} issued
								</Text>
								<Text className="text-xs font-medium">{pct}%</Text>
							</View>
						</CardContent>
					</Card>
				);
			})}
		</Screen>
	);
}
