import { Screen } from '@/components/domain/Screen';
import { EmptyState, ListRow } from '@/components/domain/widgets';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { initials } from '@/lib/format';
import { useAvailableEntitlements, useBeneficiaries, useHampers } from '@/repositories';
import { useRouter } from 'expo-router';
import { Gift, Search, Ticket } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function GoodsPicker() {
	const router = useRouter();
	const [q, setQ] = React.useState('');
	const beneficiaries = useBeneficiaries(q);
	const availableEnts = useAvailableEntitlements();
	const hampers = useHampers();

	// Beneficiaries with an available hamper entitlement.
	const rows = beneficiaries
		.map((b) => {
			const hamperEnt = availableEnts.find(
				(e) => e.beneficiaryId === b.id && e.type === 'hamper',
			);
			return hamperEnt ? { b, ent: hamperEnt } : null;
		})
		.filter((r): r is NonNullable<typeof r> => r !== null);

	return (
		<Screen scroll={false} edges={['bottom']}>
			<Text className="text-muted-foreground text-sm">
				Pick a beneficiary with a pending hamper, or issue against a voucher.
			</Text>

			<Button variant="outline" onPress={() => router.push('/vouchers')}>
				<Icon as={Ticket} size={18} className="text-primary" />
				<Text>Use a voucher instead</Text>
			</Button>

			<View className="relative justify-center">
				<View className="absolute left-3 z-10">
					<Icon as={Search} size={18} className="text-muted-foreground" />
				</View>
				<Input
					value={q}
					onChangeText={setQ}
					placeholder="Search beneficiary"
					className="h-12 rounded-xl pl-10"
				/>
			</View>

			<Card className="flex-1 overflow-hidden py-0">
				{rows.length === 0 ? (
					<EmptyState
						icon={Gift}
						title="No pending hampers"
						subtitle="Everyone assigned has been issued"
					/>
				) : (
					rows.map(({ b, ent }, i) => {
						const hamper = hampers.find((h) => h.id === ent.hamperId);
						return (
							<Animated.View
								key={b.id}
								entering={FadeInDown.duration(280).delay(Math.min(i * 50, 350))}
							>
								{i > 0 && <Separator />}
								<ListRow
									title={b.name}
									subtitle={`${b.beneficiaryNo} · ${hamper?.name ?? 'Hamper'}`}
									onPress={() => router.push(`/goods/issue/${ent.id}`)}
									leading={
										<Avatar alt={b.name} className="bg-secondary h-11 w-11">
											<AvatarFallback className="bg-secondary">
												<Text className="text-secondary-foreground font-display-medium text-sm">
													{initials(b.name)}
												</Text>
											</AvatarFallback>
										</Avatar>
									}
								/>
							</Animated.View>
						);
					})
				)}
			</Card>
		</Screen>
	);
}
