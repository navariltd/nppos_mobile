import { VoucherStatusBadge } from '@/components/domain/badges';
import { Screen } from '@/components/domain/Screen';
import { EmptyState, ListRow } from '@/components/domain/widgets';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { findVoucherByNo, findVouchersByBeneficiaryNo } from '@/data/mock';
import { formatKES } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Voucher } from '@/types/domain';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type Mode = 'voucher' | 'beneficiary';

export default function VoucherSearch() {
	const router = useRouter();
	const [mode, setMode] = React.useState<Mode>('voucher');
	const [q, setQ] = React.useState('');
	const [searched, setSearched] = React.useState(false);
	const [results, setResults] = React.useState<Voucher[]>([]);

	const runSearch = () => {
		setSearched(true);
		if (mode === 'voucher') {
			const v = findVoucherByNo(q);
			setResults(v ? [v] : []);
		} else {
			setResults(findVouchersByBeneficiaryNo(q));
		}
	};

	return (
		<Screen scroll={false} edges={['bottom']}>
			<Text className="text-muted-foreground text-sm">
				{mode === 'voucher'
					? 'Exact-match by voucher number.'
					: 'Lists all active vouchers for a beneficiary number.'}
			</Text>

			{/* Segmented mode */}
			<View className="bg-muted flex-row rounded-lg p-1">
				{(['voucher', 'beneficiary'] as Mode[]).map((m) => {
					const active = mode === m;
					return (
						<Button
							key={m}
							onPress={() => {
								setMode(m);
								setSearched(false);
								setResults([]);
							}}
							className={cn('flex-1 rounded-md py-2', active && 'bg-background shadow-sm')}
						>
							<Text className={cn('text-center text-sm font-medium', !active && 'text-muted-foreground')}>
								{m === 'voucher' ? 'Voucher No' : 'Beneficiary No'}
							</Text>
						</Button>
					);
				})}
			</View>

			<View className="flex-row gap-2">
				<View className="relative flex-1 justify-center">
					<View className="absolute left-3 z-10">
						<MaterialIcons name="search" size={18} color="#a1a1aa" />
					</View>
					<Input
						value={q}
						onChangeText={setQ}
						autoCapitalize="characters"
						placeholder={mode === 'voucher' ? 'e.g. V-2026-88231' : 'e.g. B-9001'}
						className="pl-9"
						returnKeyType="search"
						onSubmitEditing={runSearch}
					/>
				</View>
				<Pressable
					onPress={runSearch}
					className="bg-primary items-center justify-center rounded-md px-4"
				>
					<Text className="text-primary-foreground font-medium">Search</Text>
				</Pressable>
			</View>

			<Card className="flex-1 overflow-hidden py-0">
				{!searched ? (
					<EmptyState icon="local-atm" title="Search a voucher" subtitle="Try V-2026-88231 or B-9001" />
				) : results.length === 0 ? (
					<EmptyState icon="search-off" title="No match" subtitle="Check the number and try again" />
				) : (
					results.map((v, i) => (
						<View key={v.id}>
							{i > 0 && <Separator />}
							<ListRow
								title={v.voucherNo}
								subtitle={`${formatKES(v.amount)} · ${v.usesCount}/${v.maxUses} uses`}
								onPress={() => router.push(`/vouchers/${v.voucherNo}`)}
								right={
									<View className="flex-row items-center gap-2">
										<VoucherStatusBadge status={v.status} />
										<MaterialIcons name="chevron-right" size={20} color="#a1a1aa" />
									</View>
								}
							/>
						</View>
					))
				)}
			</Card>
		</Screen>
	);
}
