import { SyncBadge } from '@/components/domain/badges';
import { Screen } from '@/components/domain/Screen';
import { TXN_TYPE_STYLE } from '@/components/domain/TransactionRow';
import { EmptyState, SectionLabel } from '@/components/domain/widgets';
import { Alert as AlertBanner, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatDateTime, formatKES } from '@/lib/format';
import { useTransaction } from '@/repositories';
import { cn } from '@/lib/utils';
import type { TransactionType } from '@/types/domain';
import { useLocalSearchParams } from 'expo-router';
import {
	CalendarClock,
	CircleAlert,
	CircleCheck,
	CloudUpload,
	FileText,
	Fingerprint,
	FolderOpen,
	SearchX,
	Ticket,
	UserRound,
	type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

// How each local transaction lands in ERPNext once synced.
const SYNCS_AS: Record<TransactionType, string> = {
	goods_issue: 'Entitlement Redemption → Stock Entry (Issue)',
	cash_payment: 'Entitlement Redemption → Payment Entry (Pay)',
	stock_return: 'Stock Entry · type Return',
};

function DetailRow({
	icon,
	label,
	value,
	mono = false,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<View className="flex-row items-center gap-3">
			<Icon as={icon} size={17} className="text-muted-foreground" />
			<Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
			<Text
				className={cn('text-sm font-medium', mono && 'font-display-medium tracking-wide')}
				numberOfLines={1}
			>
				{value}
			</Text>
		</View>
	);
}

export default function TransactionDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const txn = useTransaction(id);

	if (!txn) {
		return (
			<Screen>
				<EmptyState icon={SearchX} title="Transaction not found" subtitle={id} />
			</Screen>
		);
	}

	const s = TXN_TYPE_STYLE[txn.type];

	return (
		<Screen>
			{/* Hero: what moved, how much */}
			<Animated.View entering={FadeInDown.duration(300)}>
				<Card>
					<CardContent className="items-center gap-3">
						<Animated.View
							entering={ZoomIn.springify().damping(14)}
							className={cn('h-16 w-16 items-center justify-center rounded-2xl', s.plate)}
						>
							<Icon as={s.icon} size={30} className={s.tint} />
						</Animated.View>
						<View className="items-center gap-1">
							<Badge variant="secondary">
								<Text>{s.label}</Text>
							</Badge>
							<Text className="mt-1 text-center font-medium">{txn.title}</Text>
							{txn.amount != null ? (
								<Text className="font-display text-3xl tracking-tight">
									{formatKES(txn.amount)}
								</Text>
							) : (
								<Text className="font-display text-3xl tracking-tight">×{txn.qty}</Text>
							)}
						</View>
						<SyncBadge status={txn.status} />
					</CardContent>
				</Card>
			</Animated.View>

			{/* Sync state, explained */}
			<Animated.View entering={FadeInDown.duration(300).delay(60)}>
				{txn.status === 'conflict' ? (
					<AlertBanner icon={CircleAlert} className="border-destructive/30 bg-destructive/10">
						<AlertTitle className="text-destructive">Needs review</AlertTitle>
						<AlertDescription className="text-destructive">
							{txn.conflictReason
								? `Server: ${txn.conflictReason}`
								: 'The server rejected this transaction during sync (e.g. voucher limit or validity failed re-validation).'}
							{'\n'}Held for review — an admin resolves this online; nothing is silently
							dropped.
						</AlertDescription>
					</AlertBanner>
				) : txn.status === 'pending' ? (
					<AlertBanner icon={CloudUpload} className="border-warning/40 bg-warning/10">
						<AlertTitle className="text-warning">Waiting to sync</AlertTitle>
						<AlertDescription className="text-warning">
							Recorded on this device and queued in the outbox. It will post to the backend the
							next time you're online.
						</AlertDescription>
					</AlertBanner>
				) : (
					<AlertBanner icon={CircleCheck} className="border-success/30 bg-success/10">
						<AlertTitle className="text-success">Synced</AlertTitle>
						<AlertDescription className="text-success">
							Posted to the backend{txn.serverName ? ` as ${txn.serverName}` : ''}.
						</AlertDescription>
					</AlertBanner>
				)}
			</Animated.View>

			<SectionLabel>Details</SectionLabel>
			<Animated.View entering={FadeInDown.duration(300).delay(120)}>
				<Card>
					<CardContent className="gap-3">
						{txn.beneficiaryName && (
							<DetailRow icon={UserRound} label="Beneficiary" value={txn.beneficiaryName} />
						)}
						{txn.voucherNo && <DetailRow icon={Ticket} label="Voucher" value={txn.voucherNo} />}
						<DetailRow icon={FolderOpen} label="Project" value={txn.project} />
						<DetailRow icon={CalendarClock} label="Recorded" value={formatDateTime(txn.createdAt)} />
					</CardContent>
				</Card>
			</Animated.View>

			<SectionLabel>Sync record</SectionLabel>
			<Animated.View entering={FadeInDown.duration(300).delay(180)}>
				<Card>
					<CardContent className="gap-3">
						<DetailRow icon={Fingerprint} label="Reference" value={txn.id} mono />
						<Separator />
						<DetailRow icon={FileText} label="Syncs as" value={SYNCS_AS[txn.type]} />
						{txn.serverName && (
							<DetailRow icon={CircleCheck} label="Server document" value={txn.serverName} mono />
						)}
					</CardContent>
				</Card>
			</Animated.View>
		</Screen>
	);
}
