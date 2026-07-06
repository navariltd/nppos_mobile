import { VoucherStatusBadge } from '@/components/domain/badges';
import { EntitlementCard } from '@/components/domain/EntitlementCard';
import { Screen } from '@/components/domain/Screen';
import { EmptyState, Stat } from '@/components/domain/widgets';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { getEntitlementsForVoucher, getProject, getVoucherByNo } from '@/data/mock';
import { formatDate, formatKES } from '@/lib/format';
import type { Entitlement } from '@/types/domain';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

export default function VoucherDetail() {
	const { voucherNo } = useLocalSearchParams<{ voucherNo: string }>();
	const router = useRouter();
	const voucher = getVoucherByNo(voucherNo);

	if (!voucher) {
		return (
			<Screen>
				<EmptyState icon="search-off" title="Voucher not found" subtitle={voucherNo} />
			</Screen>
		);
	}

	const project = getProject(voucher.projectId);
	const ents = getEntitlementsForVoucher(voucher.id);
	const usesLeft = voucher.maxUses - voucher.usesCount;
	const canIssue = voucher.status === 'active' && usesLeft > 0;

	const issue = (e: Entitlement) => {
		if (e.type === 'hamper') {
			router.push(`/goods/issue/${e.id}`);
		} else {
			Alert.alert(
				'Issue cash',
				`Record a Payment Entry of ${formatKES(e.amount)} against ${voucher.voucherNo}?`,
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Confirm',
						onPress: () =>
							Alert.alert('Recorded', 'Cash payout queued for sync (dummy).', [
								{ text: 'Done', onPress: () => router.back() },
							]),
					},
				]
			);
		}
	};

	return (
		<Screen>
			<Card>
				<CardContent className="gap-3 pt-6">
					<View className="flex-row items-center justify-between">
						<View>
							<Text variant="h4">{voucher.voucherNo}</Text>
							{voucher.beneficiaryNo && (
								<Text className="text-muted-foreground text-sm">{voucher.beneficiaryNo}</Text>
							)}
						</View>
						<VoucherStatusBadge status={voucher.status} />
					</View>
					<Separator />
					<View className="flex-row">
						<Stat label="Amount" value={formatKES(voucher.amount)} />
						<Stat label="Uses left" value={`${usesLeft}/${voucher.maxUses}`} />
					</View>
					<View className="flex-row items-center gap-2">
						<MaterialIcons name="event" size={16} color="#71717a" />
						<Text className="text-muted-foreground text-sm">
							Valid {formatDate(voucher.validFrom)} → {formatDate(voucher.validTo)}
						</Text>
					</View>
					<View className="flex-row items-center gap-2">
						<MaterialIcons name="folder-open" size={16} color="#71717a" />
						<Text className="text-muted-foreground text-sm">{project?.name}</Text>
					</View>
				</CardContent>
			</Card>

			{!canIssue && (
				<View className="flex-row items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
					<MaterialIcons name="info-outline" size={18} color="#b45309" />
					<Text className="flex-1 text-sm text-amber-700">
						{voucher.status === 'exhausted'
							? 'Voucher has reached its 2-use limit.'
							: voucher.status === 'expired'
								? 'Voucher is outside its validity window.'
								: 'This voucher cannot be issued.'}
					</Text>
				</View>
			)}

			<Text className="mt-1 font-semibold">Entitlements</Text>
			{ents.length === 0 ? (
				<EmptyState icon="inbox" title="No entitlements" />
			) : (
				ents.map((e) => (
					<EntitlementCard
						key={e.id}
						entitlement={e}
						actionLabel={e.type === 'hamper' ? 'Issue hamper' : 'Issue cash'}
						onAction={() => issue(e)}
						disabled={!canIssue}
					/>
				))
			)}
		</Screen>
	);
}
