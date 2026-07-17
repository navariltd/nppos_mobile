import { Screen } from '@/components/domain/Screen';
import { Stat } from '@/components/domain/widgets';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useDisbursementOrders, useProjects } from '@/repositories';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function Orders() {
	const disbursementOrders = useDisbursementOrders();
	const projects = useProjects();
	return (
		<Screen>
			{disbursementOrders.map((d, i) => {
				const project = projects.find((p) => p.id === d.projectId);
				const pct = Math.round((d.issuedCount / d.totalBeneficiaries) * 100);
				return (
					<Animated.View key={d.id} entering={FadeInDown.duration(300).delay(i * 60)}>
						<Card>
							<CardHeader>
								<View className="flex-row items-center justify-between gap-2">
									<CardTitle className="flex-1" numberOfLines={2}>
										{d.name}
									</CardTitle>
									<Badge className={d.status === 'open' ? 'bg-success/10' : 'bg-muted'}>
										<Text
											className={
												d.status === 'open'
													? 'text-success capitalize'
													: 'text-muted-foreground capitalize'
											}
										>
											{d.status}
										</Text>
									</Badge>
								</View>
								<Text className="text-muted-foreground text-sm">{project?.name}</Text>
							</CardHeader>
							<CardContent className="gap-3">
								<Progress value={pct} indicatorClassName="bg-primary" />
								<View className="flex-row">
									<Stat label="Issued" value={String(d.issuedCount)} />
									<Stat label="Beneficiaries" value={String(d.totalBeneficiaries)} />
									<Stat label="Complete" value={`${pct}%`} />
								</View>
							</CardContent>
						</Card>
					</Animated.View>
				);
			})}
		</Screen>
	);
}
