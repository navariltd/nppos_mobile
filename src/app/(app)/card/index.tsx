import { Screen } from '@/components/domain/Screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// ATM / Bank card withdrawal is a future real-time bank-API flow, not part of
// the nppos voucher model. Placeholder for now.
export default function CardComingSoon() {
	const router = useRouter();
	return (
		<Screen>
			<View className="flex-1 justify-center">
				<Animated.View entering={FadeInDown.duration(320)}>
					<Card>
						<CardContent className="items-center gap-4 pt-6">
							<View className="bg-info/10 h-16 w-16 items-center justify-center rounded-2xl">
								<Icon as={CreditCard} size={30} className="text-info" />
							</View>
							<Badge variant="secondary">
								<Text>Coming soon</Text>
							</Badge>
							<Text className="font-display-semibold text-center text-lg">
								ATM / Bank Card withdrawal
							</Text>
							<Text className="text-muted-foreground text-center text-sm">
								Card-based cash withdrawal talks to the bank in real time and isn't part of the
								voucher flow yet. It'll land in a later release.
							</Text>
							<Button variant="outline" className="mt-1 self-stretch" onPress={() => router.back()}>
								<Text>Go back</Text>
							</Button>
						</CardContent>
					</Card>
				</Animated.View>
			</View>
		</Screen>
	);
}
