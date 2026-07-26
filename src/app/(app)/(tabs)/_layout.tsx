import { useThemeMode } from '@/hooks/theme';
import { THEME } from '@/lib/theme';
import { Tabs } from 'expo-router';
import {
	Boxes,
	CircleUserRound,
	LayoutGrid,
	Receipt,
	Ticket,
	type LucideIcon,
} from 'lucide-react-native';

const icon =
	(IconComponent: LucideIcon) =>
	({ color }: { color: string; size: number }) => (
		<IconComponent color={color} size={23} strokeWidth={2} />
	);

export default function TabLayout() {
	const { scheme } = useThemeMode();
	const t = THEME[scheme];

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: t.primary,
				tabBarInactiveTintColor: t.mutedForeground,
				tabBarStyle: {
					backgroundColor: t.card,
					borderTopColor: t.border,
				},
				tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
			}}
		>
			<Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon(LayoutGrid) }} />
			<Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon(Ticket) }} />
			<Tabs.Screen
				name="transactions"
				options={{ title: 'Transactions', tabBarIcon: icon(Receipt) }}
			/>
			<Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: icon(Boxes) }} />
			<Tabs.Screen
				name="profile"
				options={{ title: 'Profile', tabBarIcon: icon(CircleUserRound) }}
			/>
		</Tabs>
	);
}
