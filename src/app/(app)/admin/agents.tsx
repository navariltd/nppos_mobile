import { Screen } from '@/components/domain/Screen';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { agentsOverview } from '@/data/mock';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function AgentsOverview() {
	return (
		<Screen>
			{agentsOverview.map((a, i) => {
				const pct = Math.round((a.issued / a.target) * 100);
				return (
					<Animated.View key={a.id} entering={FadeInDown.duration(300).delay(i * 60)}>
						<Card>
							<CardContent className="gap-3 pt-5">
								<View className="flex-row items-start justify-between gap-2">
									<View className="flex-1">
										<Text className="font-display-semibold text-base">{a.name}</Text>
										<Text className="text-muted-foreground mt-0.5 text-xs">
											{a.code} · {a.region}
										</Text>
									</View>
									{a.pending > 0 && (
										<Badge className="bg-warning/15">
											<Text className="text-warning">{a.pending} pending</Text>
										</Badge>
									)}
								</View>
								<Progress value={Math.min(pct, 100)} indicatorClassName="bg-primary" />
								<View className="flex-row items-center justify-between">
									<Text className="text-muted-foreground text-xs">
										{a.issued} / {a.target} issued
									</Text>
									<Text className="font-display-semibold text-primary text-sm">{pct}%</Text>
								</View>
							</CardContent>
						</Card>
					</Animated.View>
				);
			})}
		</Screen>
	);
}
