import { Screen } from '@/components/domain/Screen';
import { TransactionRow } from '@/components/domain/TransactionRow';
import { EmptyState } from '@/components/domain/widgets';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { transactions } from '@/data/mock';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/types/domain';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type Filter = 'all' | SyncStatus;

const FILTERS: { key: Filter; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'pending', label: 'Pending' },
	{ key: 'synced', label: 'Synced' },
	{ key: 'conflict', label: 'Needs review' },
];

export default function Transactions() {
	const [filter, setFilter] = React.useState<Filter>('all');
	const list = transactions.filter((t) => filter === 'all' || t.status === filter);

	return (
		<Screen edges={['top']} scroll={false}>
			<View>
				<Text variant="h3">Activity</Text>
				<Text className="text-muted-foreground text-sm">History · pending sync · conflicts</Text>
			</View>

			<View className="flex-row gap-2">
				{FILTERS.map((f) => {
					const active = filter === f.key;
					return (
						<Pressable
							key={f.key}
							onPress={() => setFilter(f.key)}
							className={cn(
								'rounded-full border px-3 py-1.5',
								active ? 'bg-primary border-primary' : 'border-border bg-background'
							)}
						>
							<Text
								className={cn(
									'text-xs font-medium',
									active ? 'text-primary-foreground' : 'text-muted-foreground'
								)}
							>
								{f.label}
							</Text>
						</Pressable>
					);
				})}
			</View>

			<Card className="flex-1 overflow-hidden py-0">
				{list.length === 0 ? (
					<EmptyState icon="receipt-long" title="Nothing here" subtitle="No transactions match this filter" />
				) : (
					list.map((t, i) => (
						<View key={t.id}>
							{i > 0 && <Separator />}
							<TransactionRow txn={t} />
						</View>
					))
				)}
			</Card>
		</Screen>
	);
}
