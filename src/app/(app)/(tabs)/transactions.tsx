import { Screen } from '@/components/domain/Screen';
import { TransactionRow } from '@/components/domain/TransactionRow';
import { EmptyState } from '@/components/domain/widgets';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTransactions } from '@/repositories';
import type { SyncStatus } from '@/types/domain';
import { useRouter } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

type Filter = 'all' | SyncStatus;

const FILTERS: { key: Filter; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'pending', label: 'Pending' },
	{ key: 'synced', label: 'Synced' },
	{ key: 'conflict', label: 'Needs review' },
];

export default function Transactions() {
	const router = useRouter();
	const [filter, setFilter] = React.useState<Filter>('all');
	const list = useTransactions(filter);

	return (
		<Screen edges={['top']} scroll={false}>
			<View>
				<Text variant="h3">Activity</Text>
				<Text className="text-muted-foreground mt-0.5 text-sm">
					History · pending sync · conflicts
				</Text>
			</View>

			<ToggleGroup
				type="single"
				value={filter}
				onValueChange={(v) => setFilter((v as Filter) ?? 'all')}
				className="justify-start gap-2"
			>
				{FILTERS.map((f) => (
					<ToggleGroupItem
						key={f.key}
						value={f.key}
						className="border-border bg-card h-9 rounded-full border px-3.5"
					>
						<Text className="text-xs font-medium">{f.label}</Text>
					</ToggleGroupItem>
				))}
			</ToggleGroup>

			{list.length === 0 ? (
				<Card className="py-0">
					<EmptyState
						icon={ReceiptText}
						title="Nothing here"
						subtitle="No transactions match this filter"
					/>
				</Card>
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="pb-8"
					showsVerticalScrollIndicator={false}
				>
					<Animated.View layout={LinearTransition.duration(200)}>
						<Card className="overflow-hidden gap-0 py-0">
							{list.map((t, i) => (
								// Pressable OUTSIDE the entering-animated view so the whole
								// row stays tappable on Android (Reanimated + New Arch can
								// drop touches on children of layout-animated views).
								<Pressable
									key={t.id}
									onPress={() => router.push(`/transactions/${t.id}`)}
									className="active:bg-accent/60"
								>
									<Animated.View
										entering={FadeInDown.duration(260).delay(Math.min(i * 40, 320))}
									>
										{i > 0 && <Separator />}
										<TransactionRow txn={t} />
									</Animated.View>
								</Pressable>
							))}
						</Card>
					</Animated.View>
				</ScrollView>
			)}
		</Screen>
	);
}
