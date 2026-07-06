import { Screen } from '@/components/domain/Screen';
import { EmptyState, ListRow } from '@/components/domain/widgets';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { beneficiaries, getEntitlementsForBeneficiary, getHamper } from '@/data/mock';
import { initials } from '@/lib/format';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

export default function GoodsPicker() {
	const router = useRouter();
	const [q, setQ] = React.useState('');

	// Beneficiaries with an available hamper entitlement.
	const rows = beneficiaries
		.map((b) => {
			const hamperEnt = getEntitlementsForBeneficiary(b.id).find(
				(e) => e.type === 'hamper' && e.status === 'available'
			);
			return hamperEnt ? { b, ent: hamperEnt } : null;
		})
		.filter((r): r is NonNullable<typeof r> => r !== null)
		.filter(({ b }) => {
			const query = q.trim().toLowerCase();
			return (
				!query ||
				b.name.toLowerCase().includes(query) ||
				b.beneficiaryNo.toLowerCase().includes(query)
			);
		});

	return (
		<Screen scroll={false} edges={['bottom']}>
			<Text className="text-muted-foreground text-sm">
				Pick a beneficiary with a pending hamper, or issue against a voucher.
			</Text>

			<Button variant="outline" onPress={() => router.push('/vouchers')}>
				<MaterialIcons name="local-atm" size={18} color="#0f172a" />
				<Text>Use a voucher instead</Text>
			</Button>

			<View className="relative justify-center">
				<View className="absolute left-3 z-10">
					<MaterialIcons name="search" size={18} color="#a1a1aa" />
				</View>
				<Input
					value={q}
					onChangeText={setQ}
					placeholder="Search beneficiary"
					className="pl-9"
				/>
			</View>

			<Card className="flex-1 overflow-hidden py-0">
				{rows.length === 0 ? (
					<EmptyState icon="redeem" title="No pending hampers" subtitle="Everyone assigned has been issued" />
				) : (
					rows.map(({ b, ent }, i) => {
						const hamper = getHamper(ent.hamperId);
						return (
							<View key={b.id}>
								{i > 0 && <Separator />}
								<ListRow
									title={b.name}
									subtitle={`${b.beneficiaryNo} · ${hamper?.name ?? 'Hamper'}`}
									onPress={() => router.push(`/goods/issue/${ent.id}`)}
									leading={
										<Avatar alt={b.name} className="h-10 w-10">
											<AvatarFallback>
												<Text className="text-sm font-medium">{initials(b.name)}</Text>
											</AvatarFallback>
										</Avatar>
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
