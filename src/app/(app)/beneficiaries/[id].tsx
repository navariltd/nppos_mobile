import { EntitlementCard } from '@/components/domain/EntitlementCard';
import { Screen } from '@/components/domain/Screen';
import { TransactionRow } from '@/components/domain/TransactionRow';
import { EmptyState } from '@/components/domain/widgets';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import {
	beneficiaryTransactions,
	getBeneficiary,
	getEntitlementsForBeneficiary,
	getProject,
} from '@/data/mock';
import { formatKES, initials } from '@/lib/format';
import type { Entitlement } from '@/types/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IdCard, Phone, UserRoundX, UsersRound, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

function Detail({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
	return (
		<View className="flex-row items-center gap-3">
			<Icon as={icon} size={17} className="text-muted-foreground" />
			<Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
			<Text className="text-sm font-medium">{value}</Text>
		</View>
	);
}

export default function BeneficiaryDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const beneficiary = id ? getBeneficiary(id) : undefined;
	const [confirmCash, setConfirmCash] = React.useState<Entitlement | null>(null);
	const [tab, setTab] = React.useState('entitlements');

	if (!beneficiary) {
		return (
			<Screen>
				<EmptyState icon={UserRoundX} title="Beneficiary not found" />
			</Screen>
		);
	}

	const project = getProject(beneficiary.projectId);
	const ents = getEntitlementsForBeneficiary(beneficiary.id);
	const history = beneficiaryTransactions(beneficiary.id);
	const available = ents.filter((e) => e.status === 'available').length;

	const issue = (e: Entitlement) => {
		if (e.type === 'hamper') {
			router.push(`/goods/issue/${e.id}`);
		} else if (e.type === 'card') {
			router.push('/card');
		} else {
			setConfirmCash(e);
		}
	};

	return (
		<Screen>
			<Animated.View entering={FadeInDown.duration(300)}>
				<Card>
					<CardContent className="gap-4">
						<View className="flex-row items-center gap-4">
							<Avatar alt={beneficiary.name} className="bg-secondary h-16 w-16">
								<AvatarFallback className="bg-secondary">
									<Text className="text-secondary-foreground font-display text-lg">
										{initials(beneficiary.name)}
									</Text>
								</AvatarFallback>
							</Avatar>
							<View className="flex-1">
								<Text className="font-display-semibold text-lg">{beneficiary.name}</Text>
								<Text className="text-muted-foreground text-sm">
									{beneficiary.beneficiaryNo} · {project?.code}
								</Text>
							</View>
						</View>
						<Separator />
						<View className="gap-2.5">
							<Detail icon={IdCard} label="National ID" value={beneficiary.nationalId} />
							<Detail icon={Phone} label="Phone" value={beneficiary.phone} />
							<Detail
								icon={UsersRound}
								label="Household"
								value={`${beneficiary.householdSize} people`}
							/>
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(80)}>
				<Tabs value={tab} onValueChange={setTab}>
					<TabsList className="h-11 w-full">
						<TabsTrigger value="entitlements" className="flex-1">
							<Text>Entitlements{available > 0 ? ` (${available})` : ''}</Text>
						</TabsTrigger>
						<TabsTrigger value="history" className="flex-1">
							<Text>History ({history.length})</Text>
						</TabsTrigger>
					</TabsList>

					<TabsContent value="entitlements" className="gap-4 pt-2">
						{ents.length === 0 ? (
							<Card className="py-0">
								<EmptyState title="No entitlements" subtitle="Nothing allocated on record." />
							</Card>
						) : (
							ents.map((e) => (
								<EntitlementCard
									key={e.id}
									entitlement={e}
									householdSize={beneficiary.householdSize}
									actionLabel={
										e.type === 'hamper'
											? 'Issue hamper'
											: e.type === 'card'
												? 'Card withdrawal'
												: 'Issue cash'
									}
									onAction={() => issue(e)}
								/>
							))
						)}
					</TabsContent>

					<TabsContent value="history" className="pt-2">
						{history.length === 0 ? (
							<Card className="py-0">
								<EmptyState title="No transactions yet" subtitle="Issues will appear here." />
							</Card>
						) : (
							<Card className="overflow-hidden py-0">
								{history.map((t, i) => (
									<View key={t.id}>
										{i > 0 && <Separator />}
										<TransactionRow
											txn={t}
											onPress={() => router.push(`/transactions/${t.id}`)}
										/>
									</View>
								))}
							</Card>
						)}
					</TabsContent>
				</Tabs>
			</Animated.View>

			<AlertDialog open={confirmCash !== null} onOpenChange={(open) => !open && setConfirmCash(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Issue cash</AlertDialogTitle>
						<AlertDialogDescription>
							Record {formatKES(confirmCash?.amount)} for {beneficiary.name}?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Text>Cancel</Text>
						</AlertDialogCancel>
						<AlertDialogAction
							onPress={() => {
								setConfirmCash(null);
								Alert.alert('Recorded', 'Queued for sync (dummy).');
							}}
						>
							<Text>Confirm</Text>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Screen>
	);
}
