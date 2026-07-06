import { Screen } from '@/components/domain/Screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatKES } from '@/lib/format';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

const ENTITLED = 5000;

export default function CardWithdraw() {
	const router = useRouter();
	const [amount, setAmount] = React.useState(String(ENTITLED));
	const [state, setState] = React.useState<'idle' | 'processing' | 'done'>('idle');

	const value = Number(amount) || 0;
	const overLimit = value > ENTITLED;

	const submit = () => {
		setState('processing');
		setTimeout(() => setState('done'), 1300);
	};

	if (state === 'done') {
		return (
			<Screen>
				<View className="flex-1 items-center justify-center gap-4 py-16">
					<View className="h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
						<MaterialIcons name="check" size={44} color="#059669" />
					</View>
					<Text variant="h3">Withdrawal complete</Text>
					<Text className="text-muted-foreground text-center">
						{formatKES(value)} transferred from beneficiary to agent account.
					</Text>
					<Button className="mt-2 w-full" onPress={() => router.dismissAll()}>
						<Text>Back to dashboard</Text>
					</Button>
				</View>
			</Screen>
		);
	}

	return (
		<Screen>
			<Card>
				<CardContent className="gap-3 pt-6">
					<View className="flex-row items-center gap-2">
						<MaterialIcons name="credit-card" size={18} color="#3f3f46" />
						<Text className="font-medium">Fatuma Ali · •••• 4471</Text>
					</View>
					<Separator />
					<View className="flex-row justify-between">
						<Text className="text-muted-foreground text-sm">Entitled</Text>
						<Text className="text-sm font-medium">{formatKES(ENTITLED)}</Text>
					</View>
				</CardContent>
			</Card>

			<View className="gap-1.5">
				<Text className="text-sm font-medium">Amount to withdraw</Text>
				<Input value={amount} onChangeText={setAmount} keyboardType="number-pad" />
				{overLimit && (
					<Text className="text-destructive text-xs">Exceeds entitled amount.</Text>
				)}
			</View>

			<Button
				size="lg"
				onPress={submit}
				disabled={value <= 0 || overLimit || state === 'processing'}
			>
				{state === 'processing' ? (
					<ActivityIndicator color="#fff" />
				) : (
					<>
						<MaterialIcons name="south" size={20} color="#fff" />
						<Text>Transfer {formatKES(value)}</Text>
					</>
				)}
			</Button>
			<Button variant="ghost" onPress={() => router.back()} disabled={state === 'processing'}>
				<Text>Cancel</Text>
			</Button>
		</Screen>
	);
}
