import { useSession } from '@/hooks/session';
import { useThemeMode } from '@/hooks/theme';
import { FONTS, THEME } from '@/lib/theme';
import { Redirect, Stack } from 'expo-router';

// Role guard: admins only. Agents hitting an admin deep-link bounce home.
export default function AdminLayout() {
	const { role } = useSession();
	const { scheme } = useThemeMode();
	const t = THEME[scheme];

	if (role !== 'admin') {
		return <Redirect href="/" />;
	}
	return (
		<Stack
			screenOptions={{
				headerShown: true,
				headerShadowVisible: false,
				headerStyle: { backgroundColor: t.background },
				headerTintColor: t.foreground,
				headerTitleStyle: { fontFamily: FONTS.displaySemiBold, fontSize: 17 },
				contentStyle: { backgroundColor: t.background },
			}}
		>
			<Stack.Screen name="index" options={{ title: 'Admin' }} />
			<Stack.Screen name="agents" options={{ title: 'Agents Overview' }} />
			<Stack.Screen name="orders" options={{ title: 'Assignments' }} />
		</Stack>
	);
}
