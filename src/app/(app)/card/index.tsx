import { Screen } from '@/components/domain/Screen';
import { EmptyState, Stat } from '@/components/domain/widgets';
import { Alert as AlertBanner, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useOnline } from '@/hooks/online';
import { formatKES } from '@/lib/format';
import { useAvailableEntitlements, useBeneficiary } from '@/repositories';
import { useRouter } from 'expo-router';
import { ArrowDown, CircleCheck, CloudOff, Wifi } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function CardValidate() {
	const router = useRouter();
	const { isOnline } = useOnline();
	const [card, setCard] = React.useState('');
	const [state, setState] = React.useState<'idle' | 'loading' | 'valid'>('idle');

	// Bank stub: "validating" resolves to the first open card entitlement.
	const cardEnt = useAvailableEntitlements().find((e) => e.type === 'card');
	const holder = useBeneficiary(cardEnt?.beneficiaryId);

	const validate = () => {
		setState('loading');
		setTimeout(() => setState('valid'), 900);
	};

	if (!isOnline) {
		return (
			<Screen>
				<View className="flex-1 justify-center">
					<EmptyState
						icon={CloudOff}
						title="Offline — card flow unavailable"
						subtitle="The ATM / bank card flow talks to the bank in real time and can't run offline. Reconnect to validate a card and withdraw."
					/>
					<Button variant="outline" className="self-center" onPress={() => router.back()}>
						<Text>Go back</Text>
					</Button>
				</View>
			</Screen>
		);
	}

	return (
		<Screen>
			<Animated.View entering={FadeInDown.duration(300)}>
				<AlertBanner icon={Wifi} className="border-info/30 bg-info/10">
					<AlertTitle className="text-info">Online-only flow</AlertTitle>
					<AlertDescription className="text-info">
						Balances are fetched live from the bank.
					</AlertDescription>
				</AlertBanner>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(70)}>
				<Card>
					<CardContent className="gap-4 pt-5">
						<View className="gap-2">
							<Label nativeID="cardNo">Card number</Label>
							<Input
								aria-labelledby="cardNo"
								value={card}
								onChangeText={(t) => {
									setCard(t);
									setState('idle');
								}}
								placeholder="•••• •••• •••• ••••"
								keyboardType="number-pad"
								maxLength={19}
								className="font-display-medium h-12 rounded-xl tracking-[2px]"
							/>
						</View>
						<Button
							size="lg"
							onPress={validate}
							disabled={card.length < 4 || state === 'loading'}
						>
							<Text>{state === 'loading' ? 'Contacting bank…' : 'Validate card'}</Text>
						</Button>
					</CardContent>
				</Card>
			</Animated.View>

			{state === 'loading' && (
				<Animated.View entering={FadeInDown.duration(250)}>
					<Card>
						<CardContent className="gap-3 pt-5">
							<Skeleton className="h-5 w-44" />
							<Separator />
							<View className="flex-row gap-6">
								<View className="flex-1 gap-2">
									<Skeleton className="h-7 w-24" />
									<Skeleton className="h-3 w-28" />
								</View>
								<View className="flex-1 gap-2">
									<Skeleton className="h-7 w-24" />
									<Skeleton className="h-3 w-20" />
								</View>
							</View>
							<Skeleton className="h-11 w-full rounded-md" />
						</CardContent>
					</Card>
				</Animated.View>
			)}

			{state === 'valid' &&
				(cardEnt ? (
					<Animated.View entering={FadeInDown.duration(300)}>
						<Card className="border-success/30">
							<CardContent className="gap-4 pt-5">
								<View className="flex-row items-center gap-2">
									<Icon as={CircleCheck} size={18} className="text-success" />
									<Text className="font-display-semibold text-base">
										Card valid · {holder?.name ?? 'Cardholder'}
									</Text>
								</View>
								<Separator />
								<View className="flex-row">
									<Stat label="Available balance" value={formatKES(cardEnt.amount ?? 0)} />
									<Stat label="Entitlement" value={formatKES(cardEnt.amount ?? 0)} />
								</View>
								<Button size="lg" onPress={() => router.push('/card/withdraw')}>
									<Icon as={ArrowDown} size={18} className="text-primary-foreground" />
									<Text>Initiate withdrawal</Text>
								</Button>
							</CardContent>
						</Card>
					</Animated.View>
				) : (
					<Animated.View entering={FadeInDown.duration(300)}>
						<Card>
							<EmptyState
								icon={CircleCheck}
								title="No card entitlement open"
								subtitle="Every card entitlement on your assignment has been issued."
							/>
						</Card>
					</Animated.View>
				))}
		</Screen>
	);
}
