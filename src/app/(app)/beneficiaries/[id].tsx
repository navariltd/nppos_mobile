import { EntitlementCard } from '@/components/domain/EntitlementCard';
import { Screen } from '@/components/domain/Screen';
import { TransactionRow } from '@/components/domain/TransactionRow';
import { EmptyState } from '@/components/domain/widgets';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
	beneficiaryTransactions,
	getBeneficiary,
	getEntitlementsForBeneficiary,
	getProject,
} from '@/data/mock';
import { formatKES, initials } from '@/lib/format';
import type { Entitlement } from '@/types/domain';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

export default function BeneficiaryDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const beneficiary = id ? getBeneficiary(id) : undefined;

	if (!beneficiary) {
		return (
			<Screen>
				<EmptyState icon="person-off" title="Beneficiary not found" />
			</Screen>
		);
	}

	const project = getProject(beneficiary.projectId);
	const ents = getEntitlementsForBeneficiary(beneficiary.id);
	const history = beneficiaryTransactions(beneficiary.id);

	const issue = (e: Entitlement) => {
		if (e.type === 'hamper') {
			router.push(`/goods/issue/${e.id}`);
		} else if (e.type === 'card') {
			router.push('/card');
		} else {
			Alert.alert('Issue cash', `Record ${formatKES(e.amount)} for ${beneficiary.name}?`, [
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Confirm', onPress: () => Alert.alert('Recorded', 'Queued for sync (dummy).') },
			]);
		}
	};

	return (
		<Screen>
			<Card>
				<CardContent className="gap-3 pt-6">
					<View className="flex-row items-center gap-4">
						<Avatar alt={beneficiary.name} className="h-14 w-14">
							<AvatarFallback>
								<Text className="text-lg font-semibold">{initials(beneficiary.name)}</Text>
							</AvatarFallback>
						</Avatar>
						<View className="flex-1">
							<Text className="text-lg font-semibold">{beneficiary.name}</Text>
							<Text className="text-muted-foreground text-sm">
								{beneficiary.beneficiaryNo} · {project?.code}
							</Text>
						</View>
					</View>
					<Separator />
					<View className="gap-2">
						<Detail icon="badge" label="National ID" value={beneficiary.nationalId} />
						<Detail icon="phone" label="Phone" value={beneficiary.phone} />
						<Detail icon="groups" label="Household" value={`${beneficiary.householdSize} people`} />
					</View>
				</CardContent>
			</Card>

			<Text className="mt-1 font-semibold">Entitlements</Text>
			{ents.length === 0 ? (
				<Card>
					<CardContent className="py-6">
						<Text className="text-muted-foreground text-center text-sm">
							No entitlements on record.
						</Text>
					</CardContent>
				</Card>
			) : (
				ents.map((e) => (
					<EntitlementCard
						key={e.id}
						entitlement={e}
						householdSize={beneficiary.householdSize}
						actionLabel={
							e.type === 'hamper' ? 'Issue hamper' : e.type === 'card' ? 'Card withdrawal' : 'Issue cash'
						}
						onAction={() => issue(e)}
					/>
				))
			)}

			<Text className="mt-1 font-semibold">History</Text>
			{history.length === 0 ? (
				<Card>
					<CardContent className="py-6">
						<Text className="text-muted-foreground text-center text-sm">No transactions yet.</Text>
					</CardContent>
				</Card>
			) : (
				<Card className="overflow-hidden py-0">
					{history.map((t, i) => (
						<View key={t.id}>
							{i > 0 && <Separator />}
							<TransactionRow txn={t} />
						</View>
					))}
				</Card>
			)}
		</Screen>
	);
}

function Detail({
	icon,
	label,
	value,
}: {
	icon: React.ComponentProps<typeof MaterialIcons>['name'];
	label: string;
	value: string;
}) {
	return (
		<View className="flex-row items-center gap-3">
			<MaterialIcons name={icon} size={18} color="#71717a" />
			<Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
			<Text className="text-sm font-medium">{value}</Text>
		</View>
	);
}
