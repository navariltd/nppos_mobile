import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const icon =
	(name: IconName) =>
	({ color, size }: { color: string; size: number }) => (
		<MaterialIcons name={name} size={size} color={color} />
	);

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: '#0f172a',
				tabBarInactiveTintColor: '#a1a1aa',
			}}
		>
			<Tabs.Screen
				name="index"
				options={{ title: 'Dashboard', tabBarIcon: icon('grid-view') }}
			/>
			<Tabs.Screen
				name="beneficiaries"
				options={{ title: 'People', tabBarIcon: icon('people-outline') }}
			/>
			<Tabs.Screen
				name="transactions"
				options={{ title: 'Activity', tabBarIcon: icon('receipt-long') }}
			/>
			<Tabs.Screen
				name="stock"
				options={{ title: 'Stock', tabBarIcon: icon('inventory-2') }}
			/>
			<Tabs.Screen
				name="profile"
				options={{ title: 'Profile', tabBarIcon: icon('person-outline') }}
			/>
		</Tabs>
	);
}
