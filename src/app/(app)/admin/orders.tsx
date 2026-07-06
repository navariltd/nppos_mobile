import { Screen } from '@/components/domain/Screen';
import { Stat } from '@/components/domain/widgets';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { disbursementOrders, getProject } from '@/data/mock';
import { View } from 'react-native';

export default function Orders() {
	return (
		<Screen>
			{disbursementOrders.map((d) => {
				const project = getProject(d.projectId);
				const pct = Math.round((d.issuedCount / d.totalBeneficiaries) * 100);
				return (
					<Card key={d.id}>
						<CardHeader>
							<View className="flex-row items-center justify-between">
								<CardTitle>{d.name}</CardTitle>
								<Badge className={d.status === 'open' ? 'bg-emerald-100' : 'bg-muted'}>
									<Text
										className={
											d.status === 'open' ? 'text-emerald-700' : 'text-muted-foreground'
										}
									>
										{d.status}
									</Text>
								</Badge>
							</View>
							<Text className="text-muted-foreground text-sm">{project?.name}</Text>
						</CardHeader>
						<CardContent className="gap-3">
							<View className="bg-muted h-2 overflow-hidden rounded-full">
								<View
									className="bg-primary h-full rounded-full"
									style={{ width: `${pct}%` }}
								/>
							</View>
							<View className="flex-row">
								<Stat label="Issued" value={String(d.issuedCount)} />
								<Stat label="Beneficiaries" value={String(d.totalBeneficiaries)} />
								<Stat label="Complete" value={`${pct}%`} />
							</View>
						</CardContent>
					</Card>
				);
			})}
		</Screen>
	);
}
