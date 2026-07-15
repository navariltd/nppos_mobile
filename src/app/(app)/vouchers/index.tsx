import { VoucherStatusBadge } from '@/components/domain/badges';
import { Screen } from '@/components/domain/Screen';
import { EmptyState, ListRow } from '@/components/domain/widgets';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { findVoucherByNo, findVouchersByBeneficiaryNo } from '@/data/mock';
import { formatKES } from '@/lib/format';
import type { Voucher } from '@/types/domain';
import { useRouter } from 'expo-router';
import { Search, SearchX, Ticket } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
			<Tabs
				value={mode}
				onValueChange={(v) => {
					setMode(v as Mode);
					setSearched(false);
					setResults([]);
				}}
			>
				<TabsList className="h-11 w-full">
					<TabsTrigger value="voucher" className="flex-1">
						<Text>Voucher No</Text>
					</TabsTrigger>
					<TabsTrigger value="beneficiary" className="flex-1">
						<Text>Beneficiary No</Text>
					</TabsTrigger>
				</TabsList>
			</Tabs>

			<Text className="text-muted-foreground text-sm">
				{mode === 'voucher'
					? 'Exact-match by voucher number.'
					: 'Lists all active vouchers for a beneficiary number.'}
			</Text>

			<View className="flex-row gap-2">
				<View className="relative flex-1 justify-center">
					<View className="absolute left-3 z-10">
						<Icon as={Search} size={18} className="text-muted-foreground" />
					</View>
					<Input
						value={q}
						onChangeText={setQ}
						autoCapitalize="characters"
						placeholder={mode === 'voucher' ? 'e.g. V-2026-88231' : 'e.g. B-9001'}
						className="h-12 rounded-xl pl-10"
						returnKeyType="search"
						onSubmitEditing={runSearch}
					/>
				</View>
				<Button size="lg" className="h-12 rounded-xl px-5" onPress={runSearch}>
					<Text>Search</Text>
				</Button>
			</View>

			<Card className="flex-1 overflow-hidden py-0">
				{!searched ? (
					<EmptyState
						icon={Ticket}
						title="Search a voucher"
						subtitle="Try V-2026-88231 or B-9001"
					/>
				) : results.length === 0 ? (
					<EmptyState icon={SearchX} title="No match" subtitle="Check the number and try again" />
				) : (
					results.map((v, i) => (
						<Animated.View key={v.id} entering={FadeInDown.duration(280).delay(i * 60)}>
							{i > 0 && <Separator />}
							<ListRow
								title={v.voucherNo}
								subtitle={`${formatKES(v.amount)} · ${v.usesCount}/${v.maxUses} uses`}
								onPress={() => router.push(`/vouchers/${v.voucherNo}`)}
								leading={
									<View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-xl">
										<Icon as={Ticket} size={18} className="text-primary" />
									</View>
								}
								right={<VoucherStatusBadge status={v.status} />}
							/>
						</Animated.View>
					))
				)}
			</Card>
		</Screen>
	);
}
