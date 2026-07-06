import { SyncBadge } from '@/components/domain/badges';
import { Text } from '@/components/ui/text';
import { formatDateTime, formatKES } from '@/lib/format';
import type { PosTransaction, TransactionType } from '@/types/domain';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { View } from 'react-native';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TYPE_ICON: Record<TransactionType, IconName> = {
	goods_issue: 'redeem',
	cash_payment: 'local-atm',
	card_withdrawal: 'credit-card',
	stock_return: 'undo',
};

export function TransactionRow({ txn }: { txn: PosTransaction }) {
	return (
		<View className="flex-row items-center gap-3 px-4 py-3">
			<View className="bg-muted h-9 w-9 items-center justify-center rounded-full">
				<MaterialIcons name={TYPE_ICON[txn.type]} size={18} color="#3f3f46" />
			</View>
			<View className="flex-1">
				<Text className="font-medium" numberOfLines={1}>
					{txn.title}
				</Text>
				<Text className="text-muted-foreground text-xs" numberOfLines={1}>
					{txn.subtitle} · {formatDateTime(txn.createdAt)}
				</Text>
			</View>
			<View className="items-end gap-1">
				{txn.amount != null ? (
					<Text className="font-semibold">{formatKES(txn.amount)}</Text>
				) : (
					<Text className="font-semibold">×{txn.qty}</Text>
				)}
				<SyncBadge status={txn.status} />
			</View>
		</View>
	);
}
