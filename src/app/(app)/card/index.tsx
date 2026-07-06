import { Screen } from '@/components/domain/Screen';
import { Stat } from '@/components/domain/widgets';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useOnline } from '@/hooks/online';
import { formatKES } from '@/lib/format';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function CardValidate() {
	const router = useRouter();
	const { isOnline } = useOnline();
	const [card, setCard] = React.useState('');
	const [state, setState] = React.useState<'idle' | 'loading' | 'valid'>('idle');

	const validate = () => {
		setState('loading');
		setTimeout(() => setState('valid'), 900);
	};

	if (!isOnline) {
		return (
			<Screen>
				<View className="flex-1 items-center justify-center gap-4 py-20">
					<View className="bg-muted h-20 w-20 items-center justify-center rounded-full">
						<MaterialIcons name="cloud-off" size={40} color="#a1a1aa" />
					</View>
					<Text variant="h4">Offline — card flow unavailable</Text>
					<Text className="text-muted-foreground text-center">
						The ATM / bank card flow talks to the bank in real time and can’t run offline.
						Reconnect to validate a card and withdraw.
					</Text>
					<Button variant="outline" onPress={() => router.back()}>
						<Text>Go back</Text>
					</Button>
				</View>
			</Screen>
		);
	}

	return (
		<Screen>
			<View className="flex-row items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5">
				<MaterialIcons name="wifi" size={18} color="#1d4ed8" />
				<Text className="flex-1 text-sm text-blue-700">
					Online-only flow. Balances are fetched live from the bank.
				</Text>
			</View>

			<Card>
				<CardContent className="gap-4 pt-6">
					<View className="gap-1.5">
						<Text className="text-sm font-medium">Card number</Text>
						<Input
							value={card}
							onChangeText={(t) => {
								setCard(t);
								setState('idle');
							}}
							placeholder="•••• •••• •••• ••••"
							keyboardType="number-pad"
							maxLength={19}
						/>
					</View>
					<Button onPress={validate} disabled={card.length < 4 || state === 'loading'}>
						{state === 'loading' ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Text>Validate card</Text>
						)}
					</Button>
				</CardContent>
			</Card>

			{state === 'valid' && (
				<Card>
					<CardContent className="gap-3 pt-6">
						<View className="flex-row items-center gap-2">
							<MaterialIcons name="check-circle" size={18} color="#059669" />
							<Text className="font-medium">Card valid · Fatuma Ali</Text>
						</View>
						<Separator />
						<View className="flex-row">
							<Stat label="Available balance" value={formatKES(5000)} />
							<Stat label="Entitlement" value={formatKES(5000)} />
						</View>
						<Button onPress={() => router.push('/card/withdraw')}>
							<MaterialIcons name="south" size={18} color="#fff" />
							<Text>Initiate withdrawal</Text>
						</Button>
					</CardContent>
				</Card>
			)}
		</Screen>
	);
}
