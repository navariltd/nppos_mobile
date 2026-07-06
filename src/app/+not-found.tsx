import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

export default function NotFound() {
	return (
		<>
			<Stack.Screen options={{ title: 'Not found' }} />
			<View className="bg-background flex-1 items-center justify-center gap-4 p-6">
				<MaterialIcons name="explore-off" size={48} color="#a1a1aa" />
				<Text variant="h3">This screen doesn’t exist</Text>
				<Link href="/" asChild>
					<Button variant="outline">
						<Text>Go to dashboard</Text>
					</Button>
				</Link>
			</View>
		</>
	);
}
