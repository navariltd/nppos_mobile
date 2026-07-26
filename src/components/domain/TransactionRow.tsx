import { SyncBadge } from '@/components/domain/badges';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDateTime, formatKES } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PosTransaction, TransactionType } from '@/types/domain';
import { Banknote, Gift, Undo2, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

export const TXN_TYPE_STYLE: Record<
	TransactionType,
	{ icon: LucideIcon; plate: string; tint: string; label: string }
> = {
	goods_issue: { icon: Gift, plate: 'bg-warning/15', tint: 'text-warning', label: 'Goods issue' },
	cash_payment: {
		icon: Banknote,
		plate: 'bg-success/10',
		tint: 'text-success',
		label: 'Cash payment',
	},
	stock_return: {
		icon: Undo2,
		plate: 'bg-muted',
		tint: 'text-muted-foreground',
		label: 'Stock return',
	},
};

export function TransactionRow({
	txn,
	onPress,
}: {
	txn: PosTransaction;
	onPress?: () => void;
}) {
	const s = TXN_TYPE_STYLE[txn.type];
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			className={cn('flex-row items-center gap-3 px-4 py-3.5', onPress && 'active:bg-accent/60')}
		>
			<View className={cn('h-10 w-10 items-center justify-center rounded-xl', s.plate)}>
				<Icon as={s.icon} size={18} className={s.tint} />
			</View>
			<View className="flex-1">
				<Text className="font-medium" numberOfLines={1}>
					{txn.title}
				</Text>
				<Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
					{txn.subtitle} · {formatDateTime(txn.createdAt)}
				</Text>
			</View>
			<View className="items-end gap-1">
				{txn.amount != null ? (
					<Text className="font-display-semibold text-[15px]">{formatKES(txn.amount)}</Text>
				) : (
					<Text className="font-display-semibold text-[15px]">×{txn.qty}</Text>
				)}
				<SyncBadge status={txn.status} />
			</View>
		</Pressable>
	);
}
