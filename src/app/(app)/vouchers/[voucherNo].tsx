import { VoucherStatusBadge } from '@/components/domain/badges';
import { Screen } from '@/components/domain/Screen';
import { EmptyState, SectionLabel, Stat } from '@/components/domain/widgets';
import { Alert as AlertBanner, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/hooks/currency';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fileUrl } from '@/lib/voucher-code';
import {
	redeemVoucherCash,
	redeemVoucherGoods,
	useHamper,
	useOpenPosSession,
	useRedemptionsForVoucher,
	useVoucherByNo,
} from '@/repositories';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, CalendarDays, FolderOpen, Gift, Info, SearchX } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Image, View } from 'react-native';
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
	const hamper = useHamper(voucher?.hamperId);
	const redemptions = useRedemptionsForVoucher(voucher?.id);
	const session = useOpenPosSession();
	const { format, symbol } = useCurrency();
	const [input, setInput] = React.useState('');
	const [confirming, setConfirming] = React.useState(false);

	if (!voucher) {
		return (
			<Screen>
				<EmptyState icon={SearchX} title="Voucher not found" subtitle={voucherNo} />
			</Screen>
		);
	}

	const isCash = voucher.entitlementType === 'cash';
	const qrUrl = fileUrl(voucher.image);
	const remaining = isCash
		? voucher.amount - voucher.redeemedAmount
		: (voucher.qty ?? 0) - voucher.redeemedQty;
	const usesLeft = voucher.maxUses - voucher.usesCount;
	const canIssue =
		(voucher.status === 'active' || voucher.status === 'partially_redeemed') &&
		usesLeft > 0 &&
		remaining > 0;

	// Default the amount/qty to the full remaining; agent can lower it (partial).
	const value = input.trim() === '' ? remaining : Number(input);
	const valid = Number.isFinite(value) && value > 0 && value <= remaining;

	const doRedeem = () => {
		setConfirming(false);
		const result = isCash
			? redeemVoucherCash(voucher.id, value)
			: redeemVoucherGoods(voucher.id, value);
		if (result.ok) {
			setInput('');
			Alert.alert('Recorded', 'Redemption saved offline and queued for sync.', [
				{ text: 'Done' },
			]);
		} else {
			Alert.alert('Could not redeem', result.reason);
		}
	};

	return (
		<Screen>
			{/* Voucher ticket */}
			<Animated.View entering={FadeInDown.duration(320)}>
				<Card className="overflow-hidden">
					<CardContent className="gap-4 pt-5">
						<View className="flex-row items-start justify-between gap-3">
							<View className="flex-1">
								<Text className="font-display text-xl tracking-tight">{voucher.voucherNo}</Text>
								{voucher.beneficiaryNo && (
									<Text className="text-muted-foreground mt-0.5 text-sm">
										{voucher.beneficiaryNo}
									</Text>
								)}
							</View>
							<View className="items-end gap-2">
								<VoucherStatusBadge status={voucher.status} />
								{qrUrl && (
									<Image
										source={{ uri: qrUrl }}
										style={{ width: 64, height: 64 }}
										resizeMode="contain"
										className="rounded-md bg-white"
										accessibilityLabel={`QR code for ${voucher.voucherNo}`}
									/>
								)}
							</View>
						</View>

						{/* Ticket perforation */}
						<View className="border-border border-t border-dashed" />

						<View className="flex-row items-center">
							{isCash ? (
								<Stat label="Remaining" value={format(remaining)} />
							) : (
								<Stat label="Remaining" value={`×${remaining} ${hamper?.name ? '' : ''}`.trim()} />
							)}
							<View className="flex-1 gap-1.5">
								<UseDots used={voucher.usesCount} max={voucher.maxUses} />
								<Text className="text-muted-foreground text-[11px] uppercase tracking-wider">
									{usesLeft} of {voucher.maxUses} uses left
								</Text>
							</View>
						</View>

						<View className="gap-2">
							<View className="flex-row items-center gap-2">
								<Icon as={isCash ? Banknote : Gift} size={15} className="text-muted-foreground" />
								<Text className="text-muted-foreground text-sm">
									{isCash
										? `Cash · ${format(voucher.amount)} total`
										: `${hamper?.name ?? 'Hamper'} · ${voucher.qty ?? 0} total`}
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Icon as={CalendarDays} size={15} className="text-muted-foreground" />
								<Text className="text-muted-foreground text-sm">
									Valid {formatDate(voucher.validFrom)} → {formatDate(voucher.validTo)}
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Icon as={FolderOpen} size={15} className="text-muted-foreground" />
								<Text className="text-muted-foreground text-sm">{voucher.project}</Text>
							</View>
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			{!canIssue && (
				<Animated.View entering={FadeInDown.duration(320).delay(60)}>
					<AlertBanner icon={Info} className="border-warning/40 bg-warning/10">
						<AlertTitle className="text-warning">Cannot redeem</AlertTitle>
						<AlertDescription className="text-warning">
							{voucher.status === 'redeemed'
								? 'Voucher is fully redeemed.'
								: voucher.status === 'expired'
									? 'Voucher is outside its validity window.'
									: remaining <= 0
										? 'Nothing left to redeem on this voucher.'
										: 'This voucher cannot be redeemed.'}
						</AlertDescription>
					</AlertBanner>
				</Animated.View>
			)}

			{/* Redeem — partial allowed: amount/qty defaults to the full remaining */}
			{canIssue && (
				<Animated.View entering={FadeInDown.duration(320).delay(120)}>
					<SectionLabel>{isCash ? 'Redeem cash' : 'Redeem hamper'}</SectionLabel>
					<Card>
						<CardContent className="gap-4 pt-5">
							<View className="gap-1.5">
								<Text className="text-muted-foreground text-xs">
									{isCash ? `Amount to pay out (${symbol})` : 'Quantity to issue'}
								</Text>
								<Input
									value={input}
									onChangeText={setInput}
									keyboardType={isCash ? 'decimal-pad' : 'number-pad'}
									placeholder={String(remaining)}
									className="h-12 rounded-xl"
								/>
								<Text className="text-muted-foreground text-[11px]">
									Up to {isCash ? format(remaining) : `×${remaining}`} — you can pay/issue less.
								</Text>
							</View>
							{!session && (
								<Text className="text-warning text-xs">
									Open a POS session from the dashboard before redeeming.
								</Text>
							)}
							<Button
								size="lg"
								disabled={!valid || !session}
								onPress={() => setConfirming(true)}
							>
								<Icon
									as={isCash ? Banknote : Gift}
									size={18}
									className="text-primary-foreground"
								/>
								<Text>{isCash ? 'Pay out cash' : 'Issue hamper'}</Text>
							</Button>
						</CardContent>
					</Card>
				</Animated.View>
			)}

			{/* Each voucher use — mirrors the backend's Entitlement Redemption */}
			{redemptions.length > 0 && (
				<>
					<SectionLabel>Redemptions</SectionLabel>
					<Card>
						<CardContent className="gap-2.5 pt-5">
							{redemptions.map((r) => (
								<View key={r.id} className="flex-row items-center justify-between">
									<Text className="text-muted-foreground flex-1 text-sm">
										{r.type === 'cash' ? 'Cash payout' : 'Hamper issued'} ·{' '}
										{formatDate(r.redeemedAt)}
									</Text>
									<Text className="font-display-medium text-sm">
										{r.type === 'cash' ? format(r.amount) : `×${r.qty ?? 1}`}
									</Text>
								</View>
							))}
						</CardContent>
					</Card>
				</>
			)}

			{/* Redemption confirmation */}
			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{isCash ? 'Issue cash' : 'Issue hamper'}</AlertDialogTitle>
						<AlertDialogDescription>
							{isCash
								? `Record an Entitlement Redemption of ${format(value)} against ${voucher.voucherNo}?`
								: `Issue ${value} × ${hamper?.name ?? 'hamper'} against ${voucher.voucherNo}?`}{' '}
							This uses 1 of the voucher's {voucher.maxUses} allowed transactions.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Text>Cancel</Text>
						</AlertDialogCancel>
						<AlertDialogAction onPress={doRedeem}>
							<Text>Confirm</Text>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Screen>
	);
}
