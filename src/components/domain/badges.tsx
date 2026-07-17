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
			? 'bg-success/10'
			: status === 'pending'
				? 'bg-warning/15'
				: 'bg-destructive/10';
	const textCls =
		status === 'synced' ? 'text-success' : status === 'pending' ? 'text-warning' : 'text-destructive';
	return (
		<Badge className={cls}>
			<Text className={textCls}>{SYNC_LABEL[status]}</Text>
		</Badge>
	);
}

export function VoucherStatusBadge({ status }: { status: VoucherStatus }) {
	const map: Record<VoucherStatus, { cls: string; text: string; label: string }> = {
		active: { cls: 'bg-success/10', text: 'text-success', label: 'Active' },
		partially_redeemed: { cls: 'bg-warning/15', text: 'text-warning', label: 'Partially redeemed' },
		redeemed: { cls: 'bg-muted', text: 'text-muted-foreground', label: 'Redeemed' },
		expired: { cls: 'bg-destructive/10', text: 'text-destructive', label: 'Expired' },
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
