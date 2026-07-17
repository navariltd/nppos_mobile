import { Screen } from '@/components/domain/Screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatKES } from '@/lib/format';
import {
	recordCardWithdrawal,
	useAvailableEntitlements,
	useBeneficiary,
} from '@/repositories';
import { useRouter } from 'expo-router';
import { ArrowDown, Check, CreditCard } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

export default function CardWithdraw() {
	const router = useRouter();
	// Bank stub: works against the first open card entitlement (same as validate).
	const cardEnt = useAvailableEntitlements().find((e) => e.type === 'card');
	const holder = useBeneficiary(cardEnt?.beneficiaryId);
	const entitled = cardEnt?.amount ?? 0;
	const [amount, setAmount] = React.useState('');
	const [state, setState] = React.useState<'idle' | 'processing' | 'done'>('idle');

	// Live-query data lands after first render; default the input once it does.
	React.useEffect(() => {
		if (cardEnt && amount === '') setAmount(String(cardEnt.amount ?? 0));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cardEnt]);

	const value = Number(amount) || 0;
	const overLimit = value > entitled;
	const presets = [1000, 2500, entitled];

	const submit = () => {
		if (!cardEnt) return;
		const entId = cardEnt.id;
		setState('processing');
		// Fake bank round-trip; the local record lands when it "confirms".
		setTimeout(() => {
			const result = recordCardWithdrawal(entId, value);
			if (result.ok) {
				setState('done');
			} else {
				setState('idle');
				Alert.alert('Withdrawal failed', result.reason);
			}
		}, 1300);
	};

	if (state === 'done') {
		return (
			<Screen>
				<View className="flex-1 items-center justify-center gap-5 py-16">
					<Animated.View
						entering={ZoomIn.springify().damping(12)}
						className="bg-success/10 h-24 w-24 items-center justify-center rounded-full"
					>
						<Icon as={Check} size={52} className="text-success" />
					</Animated.View>
					<Animated.View entering={FadeInDown.duration(350).delay(150)} className="items-center gap-2">
						<Text variant="h3">Withdrawal complete</Text>
						<Text className="text-muted-foreground px-4 text-center">
							{formatKES(value)} transferred from beneficiary to agent account.
						</Text>
					</Animated.View>
					<Animated.View entering={FadeInDown.duration(350).delay(300)} className="w-full">
						<Button size="lg" className="mt-2 w-full" onPress={() => router.dismissAll()}>
							<Text>Back to dashboard</Text>
						</Button>
					</Animated.View>
				</View>
			</Screen>
		);
	}

	return (
		<Screen>
			<Animated.View entering={FadeInDown.duration(300)}>
				<Card>
					<CardContent className="gap-3 pt-5">
						<View className="flex-row items-center gap-2.5">
							<View className="bg-info/10 h-10 w-10 items-center justify-center rounded-xl">
								<Icon as={CreditCard} size={18} className="text-info" />
							</View>
							<View>
								<Text className="font-medium">{holder?.name ?? 'Cardholder'}</Text>
								<Text className="text-muted-foreground font-display-medium text-xs tracking-widest">
									•••• 4471
								</Text>
							</View>
						</View>
						<Separator />
						<View className="flex-row justify-between">
							<Text className="text-muted-foreground text-sm">Entitled</Text>
							<Text className="font-display-semibold text-sm">{formatKES(entitled)}</Text>
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(70)} className="gap-2">
				<Label nativeID="amount">Amount to withdraw</Label>
				<Input
					aria-labelledby="amount"
					value={amount}
					onChangeText={setAmount}
					keyboardType="number-pad"
					className="font-display h-14 rounded-xl text-xl"
				/>
				{overLimit && (
					<Text className="text-destructive text-xs">Exceeds entitled amount.</Text>
				)}
				<View className="mt-1 flex-row gap-2">
					{presets.map((p) => (
						<Button
							key={p}
							variant={value === p ? 'secondary' : 'outline'}
							size="sm"
							className="flex-1 rounded-full"
							onPress={() => setAmount(String(p))}
						>
							<Text>{p === entitled ? 'Full amount' : formatKES(p)}</Text>
						</Button>
					))}
				</View>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(140)} className="gap-3">
				<Button
					size="lg"
					onPress={submit}
					disabled={value <= 0 || overLimit || state === 'processing'}
				>
					{state === 'processing' ? (
						<ActivityIndicator color="#ffffff" />
					) : (
						<>
							<Icon as={ArrowDown} size={20} className="text-primary-foreground" />
							<Text>Transfer {formatKES(value)}</Text>
						</>
					)}
				</Button>
				<Button variant="ghost" onPress={() => router.back()} disabled={state === 'processing'}>
					<Text>Cancel</Text>
				</Button>
			</Animated.View>
		</Screen>
	);
}
