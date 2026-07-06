import { useSession } from '@/hooks/session';
import { Redirect, Stack } from 'expo-router';

// Role guard: admins only. Agents hitting an admin deep-link bounce home.
export default function AdminLayout() {
	const { role } = useSession();
	if (role !== 'admin') {
		return <Redirect href="/" />;
	}
	return (
		<Stack screenOptions={{ headerShown: true }}>
			<Stack.Screen name="index" options={{ title: 'Admin' }} />
			<Stack.Screen name="agents" options={{ title: 'Agents Overview' }} />
			<Stack.Screen name="orders" options={{ title: 'Disbursement Orders' }} />
		</Stack>
	);
}
