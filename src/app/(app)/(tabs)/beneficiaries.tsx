import { Screen } from '@/components/domain/Screen';
import { EmptyState, ListRow } from '@/components/domain/widgets';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { initials } from '@/lib/format';
import { useAvailableEntitlements, useBeneficiaries } from '@/repositories';
import { useRouter } from 'expo-router';
import { Search, UserSearch } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function Beneficiaries() {
	const router = useRouter();
	const [q, setQ] = React.useState('');
	const results = useBeneficiaries(q);
	const availableEnts = useAvailableEntitlements();

	return (
		<Screen edges={['top']} scroll={false}>
			<View>
				<Text variant="h3">Beneficiaries</Text>
				<Text className="text-muted-foreground mt-0.5 text-sm">
					{results.length} assigned to you
				</Text>
			</View>

			<View className="relative justify-center">
				<View className="absolute left-3 z-10">
					<Icon as={Search} size={18} className="text-muted-foreground" />
				</View>
				<Input
					value={q}
					onChangeText={setQ}
					placeholder="Search name or beneficiary no"
					className="h-12 rounded-xl pl-10"
				/>
			</View>

			{results.length === 0 ? (
				<Card className="py-0">
					<EmptyState icon={UserSearch} title="No beneficiaries" subtitle="Try a different search" />
				</Card>
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="pb-8"
					showsVerticalScrollIndicator={false}
				>
					<Card className="overflow-hidden py-0">
						{results.map((b, i) => {
							const available = availableEnts.filter((e) => e.beneficiaryId === b.id).length;
							return (
								<Animated.View
									key={b.id}
									entering={FadeInDown.duration(280).delay(Math.min(i * 45, 360))}
								>
									{i > 0 && <Separator />}
									<ListRow
										title={b.name}
										subtitle={`${b.beneficiaryNo} · ${b.householdSize}-person household`}
										onPress={() => router.push(`/beneficiaries/${b.id}`)}
										leading={
											<Avatar alt={b.name} className="bg-secondary h-11 w-11">
												<AvatarFallback className="bg-secondary">
													<Text className="text-secondary-foreground font-display-medium text-sm">
														{initials(b.name)}
													</Text>
												</AvatarFallback>
											</Avatar>
										}
										right={
											available > 0 ? (
												<Badge className="bg-success/10">
													<Text className="text-success">{available} available</Text>
												</Badge>
											) : (
												<Badge className="bg-muted">
													<Text className="text-muted-foreground">Issued</Text>
												</Badge>
											)
										}
									/>
								</Animated.View>
							);
						})}
					</Card>
				</ScrollView>
			)}
		</Screen>
	);
}
