import { VoucherStatusBadge } from '@/components/domain/badges';
import { HamperContentsDialog } from '@/components/domain/HamperContentsDialog';
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
import { useActivePosProfile } from '@/hooks/pos-profile';
import { formatDate } from '@/lib/format';
import { isVoucherHiddenFromScan, maxUsesFor } from '@/lib/pos-settings';
import { cn } from '@/lib/utils';
import { fileUrl } from '@/lib/voucher-code';
import {
	redeemVoucherCash,
	redeemVoucherGoods,
	staleSyncMessage,
	useBeneficiary,
	useHamper,
	useOpenPosSession,
	useRedemptionsForVoucher,
	useSettings,
	useSyncFreshness,
	useVoucherByNo,
} from '@/repositories';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	Banknote,
	BadgeCheck,
	CalendarDays,
	ChevronRight,
	FolderOpen,
	Gift,
	IdCard,
	Info,
	SearchX,
	Store,
	User,
	Users,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// The configured use limit, made visible: one dot per allowed use.
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
	const beneficiary = useBeneficiary(voucher?.beneficiaryNo);
	const redemptions = useRedemptionsForVoucher(voucher?.id);
	const session = useOpenPosSession();
	const profile = useActivePosProfile();
	const settings = useSettings();
	const freshness = useSyncFreshness();
	const { format, symbol } = useCurrency();
	const [input, setInput] = React.useState('');
	const [confirming, setConfirming] = React.useState(false);
	const [showContents, setShowContents] = React.useState(false);

	if (!voucher) {
		return (
			<Screen>
				<EmptyState icon={SearchX} title="Voucher not found" subtitle={voucherNo} />
			</Screen>
		);
	}

	// Setting 3: where spent vouchers are hidden, the detail is closed off too —
	// otherwise a deep link or the back button would still expose the
	// beneficiary, amounts and redemption history a scan is meant to withhold.
	if (isVoucherHiddenFromScan(voucher, settings)) {
		return (
			<Screen>
				<EmptyState
					icon={SearchX}
					title="Already redeemed"
					subtitle={`${voucher.voucherNo} has been fully redeemed.`}
				/>
			</Screen>
		);
	}

	const isCash = voucher.entitlementType === 'cash';
	const qrUrl = fileUrl(voucher.image);
	const remaining = isCash
		? voucher.amount - voucher.redeemedAmount
		: (voucher.qty ?? 0) - voucher.redeemedQty;
	const maxUses = maxUsesFor(voucher, settings);
	const usesLeft = maxUses - voucher.usesCount;
	// A voucher from another profile's warehouse is reachable by an exact
	// voucher-no search (deliberately — the agent scanned it and deserves a real
	// answer) but must not be issued against this shift. The mutation refuses it
	// too; this is the UI half so the button is never a dead end.
	const wrongWarehouse =
		!!voucher.warehouse && !!profile?.warehouse && voucher.warehouse !== profile.warehouse;
	const canIssue =
		(voucher.status === 'active' || voucher.status === 'partially_redeemed') &&
		usesLeft > 0 &&
		remaining > 0 &&
		!wrongWarehouse &&
		// Setting 1: nothing may be issued from a device that has been out of
		// contact past the configured limit (the mutation refuses it too).
		!freshness.isStale;

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
										{settings.showBeneficiaryDetails && beneficiary
											? `${beneficiary.fullName} · ${voucher.beneficiaryNo}`
											: voucher.beneficiaryNo}
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
								<UseDots used={voucher.usesCount} max={maxUses} />
								<Text className="text-muted-foreground text-[11px] uppercase tracking-wider">
									{usesLeft} of {maxUses} uses left
								</Text>
							</View>
						</View>

						<View className="gap-2">
							{/* Tapping the hamper opens its component list — the agent needs to
							    know what goes in the bag before handing it over. */}
							{isCash ? (
								<View className="flex-row items-center gap-2">
									<Icon as={Banknote} size={15} className="text-muted-foreground" />
									<Text className="text-muted-foreground text-sm">
										Cash · {format(voucher.amount)} total
									</Text>
								</View>
							) : settings.showHamperContents ? (
								<Pressable
									onPress={() => setShowContents(true)}
									accessibilityRole="button"
									accessibilityLabel={`Show contents of ${hamper?.name ?? 'hamper'}`}
									className="active:bg-accent/60 -mx-2 flex-row items-center gap-2 rounded-lg px-2 py-1"
								>
									<Icon as={Gift} size={15} className="text-primary" />
									<Text className="text-primary flex-1 text-sm font-medium" numberOfLines={1}>
										{hamper?.name ?? 'Hamper'} · {voucher.qty ?? 0} total
									</Text>
									<Text className="text-muted-foreground text-[11px]">View contents</Text>
									<Icon as={ChevronRight} size={14} className="text-muted-foreground" />
								</Pressable>
							) : (
								/* Setting 5 off: name the hamper, but no way into its contents. */
								<View className="flex-row items-center gap-2">
									<Icon as={Gift} size={15} className="text-muted-foreground" />
									<Text className="text-muted-foreground flex-1 text-sm" numberOfLines={1}>
										{hamper?.name ?? 'Hamper'} · {voucher.qty ?? 0} total
									</Text>
								</View>
							)}
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
							{voucher.warehouse ? (
								<View className="flex-row items-center gap-2">
									<Icon
										as={Store}
										size={15}
										className={wrongWarehouse ? 'text-warning' : 'text-muted-foreground'}
									/>
									<Text
										className={cn(
											'text-sm',
											wrongWarehouse ? 'text-warning' : 'text-muted-foreground',
										)}
									>
										{voucher.warehouse}
									</Text>
								</View>
							) : null}
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			{/* Who the voucher belongs to — the agent confirms the person in front of
			    them before issuing. Walk-in vouchers have no beneficiary record. */}
			{settings.showBeneficiaryDetails && beneficiary && (
				<Animated.View entering={FadeInDown.duration(320).delay(40)}>
					<SectionLabel>Beneficiary</SectionLabel>
					<Card>
						<CardContent className="gap-3 pt-5">
							<View className="flex-row items-center gap-3">
								<View className="bg-primary/10 h-11 w-11 items-center justify-center rounded-xl">
									<Icon as={User} size={20} className="text-primary" />
								</View>
								<View className="flex-1">
									<Text className="font-display-semibold text-base" numberOfLines={1}>
										{beneficiary.fullName}
									</Text>
									<Text className="text-muted-foreground text-xs">{beneficiary.id}</Text>
								</View>
								{beneficiary.status && (
									<View className="border-border flex-row items-center gap-1 rounded-full border px-2.5 py-1">
										<Icon as={BadgeCheck} size={13} className="text-muted-foreground" />
										<Text className="text-muted-foreground text-xs">{beneficiary.status}</Text>
									</View>
								)}
							</View>
							{(beneficiary.idNumber || beneficiary.householdSize > 0) && (
								<View className="flex-row items-center gap-4">
									{beneficiary.idNumber && (
										<View className="flex-row items-center gap-2">
											<Icon as={IdCard} size={15} className="text-muted-foreground" />
											<Text className="text-muted-foreground text-sm">
												ID {beneficiary.idNumber}
											</Text>
										</View>
									)}
									{beneficiary.householdSize > 0 && (
										<View className="flex-row items-center gap-2">
											<Icon as={Users} size={15} className="text-muted-foreground" />
											<Text className="text-muted-foreground text-sm">
												Household of {beneficiary.householdSize}
											</Text>
										</View>
									)}
								</View>
							)}
						</CardContent>
					</Card>
				</Animated.View>
			)}

			{!canIssue && (
				<Animated.View entering={FadeInDown.duration(320).delay(60)}>
					<AlertBanner icon={Info} className="border-warning/40 bg-warning/10">
						<AlertTitle className="text-warning">
							{freshness.isStale
								? 'Sync required'
								: wrongWarehouse
									? 'Different POS profile'
									: 'Cannot redeem'}
						</AlertTitle>
						<AlertDescription className="text-warning">
							{freshness.isStale
								? staleSyncMessage(freshness)
								: wrongWarehouse
									? `This voucher belongs to ${voucher.warehouse}. Switch to that POS profile to redeem it.`
									: voucher.status === 'redeemed'
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

			{settings.showHamperContents && (
				<HamperContentsDialog
					open={showContents}
					onOpenChange={setShowContents}
					title={hamper?.name ?? 'Hamper'}
					bomId={voucher.bomId}
					hamperId={voucher.hamperId}
					multiplier={Math.max(1, Math.trunc(valid ? value : remaining))}
				/>
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
							This uses 1 of the voucher's {maxUses} allowed transactions.
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
