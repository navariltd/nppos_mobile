import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Link, Stack } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

export default function NotFound() {
	return (
		<>
			<Stack.Screen options={{ title: 'Not found' }} />
			<View className="bg-background flex-1 items-center justify-center gap-5 p-6">
				<Animated.View
					entering={ZoomIn.springify().damping(14)}
					className="bg-muted h-20 w-20 items-center justify-center rounded-full"
				>
					<Icon as={Compass} size={36} className="text-muted-foreground/70" />
				</Animated.View>
				<Animated.View entering={FadeInDown.duration(300).delay(100)} className="items-center gap-2">
					<Text variant="h3">This screen doesn't exist</Text>
					<Text className="text-muted-foreground text-center text-sm">
						The link may be stale or the route was moved.
					</Text>
				</Animated.View>
				<Link href="/" asChild>
					<Button variant="outline">
						<Text>Go to dashboard</Text>
					</Button>
				</Link>
			</View>
		</>
	);
}
