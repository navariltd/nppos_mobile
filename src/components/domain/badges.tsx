import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import type { EntitlementType, SyncStatus, VoucherStatus } from '@/types/domain';

const SYNC_LABEL: Record<SyncStatus, string> = {
	pending: 'Pending sync',
	synced: 'Synced',
	conflict: 'Needs review',
};

// Badge is monochrome by design; we tint via className to signal state.
export function SyncBadge({ status }: { status: SyncStatus }) {
	const cls =
		status === 'synced'
			? 'bg-emerald-100'
			: status === 'pending'
				? 'bg-amber-100'
				: 'bg-red-100';
	const textCls =
		status === 'synced'
			? 'text-emerald-700'
			: status === 'pending'
				? 'text-amber-700'
				: 'text-red-700';
	return (
		<Badge className={cls}>
			<Text className={textCls}>{SYNC_LABEL[status]}</Text>
		</Badge>
	);
}

export function VoucherStatusBadge({ status }: { status: VoucherStatus }) {
	const map: Record<VoucherStatus, { cls: string; text: string; label: string }> = {
		active: { cls: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
		expired: { cls: 'bg-red-100', text: 'text-red-700', label: 'Expired' },
		exhausted: { cls: 'bg-muted', text: 'text-muted-foreground', label: 'Exhausted' },
	};
	const m = map[status];
	return (
		<Badge className={m.cls}>
			<Text className={m.text}>{m.label}</Text>
		</Badge>
	);
}

const ENT_LABEL: Record<EntitlementType, string> = {
	hamper: 'Hamper',
	cash: 'Cash',
	card: 'Card',
};

export function EntitlementTypeBadge({ type }: { type: EntitlementType }) {
	return (
		<Badge variant="secondary">
			<Text>{ENT_LABEL[type]}</Text>
		</Badge>
	);
}
