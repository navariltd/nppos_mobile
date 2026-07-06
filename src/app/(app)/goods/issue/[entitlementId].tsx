import { EntitlementCard } from '@/components/domain/EntitlementCard';
import { Screen } from '@/components/domain/Screen';
import { EmptyState } from '@/components/domain/widgets';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { getBeneficiary, getEntitlement, getProject, getVoucher } from '@/data/mock';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; value: string }) {
	return (
		<View className="flex-row items-center gap-3">
			<MaterialIcons name={icon} size={18} color="#71717a" />
			<Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
			<Text className="text-sm font-medium">{value}</Text>
		</View>
	);
}

export default function ConfirmIssue() {
	const { entitlementId } = useLocalSearchParams<{ entitlementId: string }>();
	const router = useRouter();
	const [done, setDone] = React.useState(false);

	const ent = getEntitlement(entitlementId);
	if (!ent) {
		return (
			<Screen>
				<EmptyState icon="error-outline" title="Entitlement not found" subtitle={entitlementId} />
			</Screen>
		);
	}

	const beneficiary = ent.beneficiaryId ? getBeneficiary(ent.beneficiaryId) : undefined;
	const voucher = ent.voucherId ? getVoucher(ent.voucherId) : undefined;
	const project = getProject(ent.projectId);
	const recipient = beneficiary?.name ?? voucher?.voucherNo ?? '—';

	if (done) {
		return (
			<Screen>
				<View className="flex-1 items-center justify-center gap-4 py-16">
					<View className="h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
						<MaterialIcons name="check" size={44} color="#059669" />
					</View>
					<Text variant="h3">Hamper issued</Text>
					<Text className="text-muted-foreground text-center">
						Goods-issue recorded for {recipient}. Queued as a Stock Entry for background sync.
					</Text>
					<Button className="mt-2 w-full" onPress={() => router.dismissAll()}>
						<Text>Back to dashboard</Text>
					</Button>
				</View>
			</Screen>
		);
	}

	return (
		<Screen>
			<Card>
				<CardContent className="gap-3 pt-6">
					<InfoRow icon="person-outline" label="Recipient" value={recipient} />
					{beneficiary && (
						<InfoRow icon="badge" label="Beneficiary no" value={beneficiary.beneficiaryNo} />
					)}
					{voucher && <InfoRow icon="local-atm" label="Voucher" value={voucher.voucherNo} />}
					<InfoRow icon="folder-open" label="Project" value={project?.code ?? '—'} />
					<InfoRow icon="assignment" label="DO" value={ent.disbursementOrderId} />
				</CardContent>
			</Card>

			<EntitlementCard entitlement={ent} householdSize={beneficiary?.householdSize} />

			<View className="flex-row items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5">
				<MaterialIcons name="info-outline" size={18} color="#1d4ed8" />
				<Text className="flex-1 text-sm text-blue-700">
					Confirming deducts from your warehouse and records the issue offline.
				</Text>
			</View>

			<Button size="lg" onPress={() => setDone(true)}>
				<MaterialIcons name="check" size={20} color="#fff" />
				<Text>Confirm issue</Text>
			</Button>
			<Button variant="ghost" onPress={() => router.back()}>
				<Text>Cancel</Text>
			</Button>
		</Screen>
	);
}
