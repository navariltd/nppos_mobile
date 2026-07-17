import { VoucherStatusBadge } from '@/components/domain/badges';
import { EntitlementCard } from '@/components/domain/EntitlementCard';
import { Screen } from '@/components/domain/Screen';
import { EmptyState, SectionLabel, Stat } from '@/components/domain/widgets';
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
import { Alert as AlertBanner, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDate, formatKES } from '@/lib/format';
import {
	issueCashEntitlement,
	useEntitlementsForVoucher,
	useProject,
	useVoucherByNo,
} from '@/repositories';
import { cn } from '@/lib/utils';
import type { Entitlement } from '@/types/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, FolderOpen, Info, SearchX } from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// The 2-use hard limit, made visible: one dot per allowed use.
function UseDots({ used, max }: { used: number; max: number }) {
	return (
		<View className="flex-row items-center gap-1.5">
			{Array.from({ length: max }).map((_, i) => (
				<View
					key={i}
					className={cn(
						'h-3 w-3 rounded-full',
						i < used ? 'bg-primary' : 'border-border bg-muted border',
					)}
				/>
			))}
		</View>
	);
}

export default function VoucherDetail() {
	const { voucherNo } = useLocalSearchParams<{ voucherNo: string }>();
	const router = useRouter();
	const voucher = useVoucherByNo(voucherNo);
	const project = useProject(voucher?.projectId);
	const ents = useEntitlementsForVoucher(voucher?.id);
	const [confirmCash, setConfirmCash] = React.useState<Entitlement | null>(null);

	if (!voucher) {
		return (
			<Screen>
				<EmptyState icon={SearchX} title="Voucher not found" subtitle={voucherNo} />
			</Screen>
		);
	}

	const usesLeft = voucher.maxUses - voucher.usesCount;
	const canIssue = voucher.status === 'active' && usesLeft > 0;

	const issue = (e: Entitlement) => {
		if (e.type === 'hamper') {
			router.push(`/goods/issue/${e.id}`);
		} else {
			setConfirmCash(e);
		}
	};

	return (
		<Screen>
			{/* Voucher ticket */}
			<Animated.View entering={FadeInDown.duration(320)}>
				<Card className="overflow-hidden">
					<CardContent className="gap-4 pt-5">
						<View className="flex-row items-start justify-between">
							<View>
								<Text className="font-display text-xl tracking-tight">{voucher.voucherNo}</Text>
								{voucher.beneficiaryNo && (
									<Text className="text-muted-foreground mt-0.5 text-sm">
										{voucher.beneficiaryNo}
									</Text>
								)}
							</View>
							<VoucherStatusBadge status={voucher.status} />
						</View>

						{/* Ticket perforation */}
						<View className="border-border border-t border-dashed" />

						<View className="flex-row items-center">
							<Stat label="Amount" value={formatKES(voucher.amount)} />
							<View className="flex-1 gap-1.5">
								<UseDots used={voucher.usesCount} max={voucher.maxUses} />
								<Text className="text-muted-foreground text-[11px] uppercase tracking-wider">
									{usesLeft} of {voucher.maxUses} uses left
								</Text>
							</View>
						</View>

						<View className="gap-2">
							<View className="flex-row items-center gap-2">
								<Icon as={CalendarDays} size={15} className="text-muted-foreground" />
								<Text className="text-muted-foreground text-sm">
									Valid {formatDate(voucher.validFrom)} → {formatDate(voucher.validTo)}
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Icon as={FolderOpen} size={15} className="text-muted-foreground" />
								<Text className="text-muted-foreground text-sm">{project?.name}</Text>
							</View>
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			{!canIssue && (
				<Animated.View entering={FadeInDown.duration(320).delay(60)}>
					<AlertBanner icon={Info} className="border-warning/40 bg-warning/10">
						<AlertTitle className="text-warning">Cannot issue</AlertTitle>
						<AlertDescription className="text-warning">
							{voucher.status === 'exhausted'
								? 'Voucher has reached its 2-use limit.'
								: voucher.status === 'expired'
									? 'Voucher is outside its validity window.'
									: 'This voucher cannot be issued.'}
						</AlertDescription>
					</AlertBanner>
				</Animated.View>
			)}

			<SectionLabel>Entitlements</SectionLabel>
			{ents.length === 0 ? (
				<EmptyState title="No entitlements" />
			) : (
				ents.map((e, i) => (
					<Animated.View key={e.id} entering={FadeInDown.duration(320).delay(120 + i * 70)}>
						<EntitlementCard
							entitlement={e}
							actionLabel={e.type === 'hamper' ? 'Issue hamper' : 'Issue cash'}
							onAction={() => issue(e)}
							disabled={!canIssue}
						/>
					</Animated.View>
				))
			)}

			{/* Cash payout confirmation */}
			<AlertDialog open={confirmCash !== null} onOpenChange={(open) => !open && setConfirmCash(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Issue cash</AlertDialogTitle>
						<AlertDialogDescription>
							Record a Payment Entry of {formatKES(confirmCash?.amount)} against{' '}
							{voucher.voucherNo}? This uses 1 of the voucher's {voucher.maxUses} allowed
							transactions.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Text>Cancel</Text>
						</AlertDialogCancel>
						<AlertDialogAction
							onPress={() => {
								const ent = confirmCash;
								setConfirmCash(null);
								if (!ent) return;
								const result = issueCashEntitlement(ent.id);
								if (result.ok) {
									Alert.alert('Recorded', 'Cash payout saved offline and queued for sync.', [
										{ text: 'Done', onPress: () => router.back() },
									]);
								} else {
									Alert.alert('Could not issue', result.reason);
								}
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
