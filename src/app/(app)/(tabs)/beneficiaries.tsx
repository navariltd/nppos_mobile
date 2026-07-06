import { Screen } from '@/components/domain/Screen';
import { EmptyState, ListRow } from '@/components/domain/widgets';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { getEntitlementsForBeneficiary, searchBeneficiaries } from '@/data/mock';
import { initials } from '@/lib/format';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

export default function Beneficiaries() {
	const router = useRouter();
	const [q, setQ] = React.useState('');
	const results = searchBeneficiaries(q);

	return (
		<Screen edges={['top']} scroll={false}>
			<View>
				<Text variant="h3">Beneficiaries</Text>
				<Text className="text-muted-foreground text-sm">Your assigned list</Text>
			</View>

			<View className="flex-row items-center gap-2">
				<View className="relative flex-1 justify-center">
					<View className="absolute left-3 z-10">
						<MaterialIcons name="search" size={18} color="#a1a1aa" />
					</View>
					<Input
						value={q}
						onChangeText={setQ}
						placeholder="Search name or beneficiary no"
						className="pl-9"
					/>
				</View>
			</View>

			<Card className="flex-1 overflow-hidden py-0">
				{results.length === 0 ? (
					<EmptyState icon="person-search" title="No beneficiaries" subtitle="Try a different search" />
				) : (
					results.map((b, i) => {
						const ents = getEntitlementsForBeneficiary(b.id);
						const available = ents.filter((e) => e.status === 'available').length;
						return (
							<View key={b.id}>
								{i > 0 && <Separator />}
								<ListRow
									title={b.name}
									subtitle={`${b.beneficiaryNo} · ${b.householdSize}-person household`}
									onPress={() => router.push(`/beneficiaries/${b.id}`)}
									leading={
										<Avatar alt={b.name} className="h-10 w-10">
											<AvatarFallback>
												<Text className="text-sm font-medium">{initials(b.name)}</Text>
											</AvatarFallback>
										</Avatar>
									}
									right={
										<View className="items-end gap-1">
											<Text className="text-muted-foreground text-xs">
												{available > 0 ? `${available} available` : 'Issued'}
											</Text>
											<MaterialIcons name="chevron-right" size={20} color="#a1a1aa" />
										</View>
									}
								/>
							</View>
						);
					})
				)}
			</Card>
		</Screen>
	);
}
