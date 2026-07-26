import { useSession } from '@/hooks/session';
import { useThemeMode } from '@/hooks/theme';
import { FONTS, THEME } from '@/lib/theme';
import { Redirect, Stack } from 'expo-router';

// Auth guard for the whole authenticated app. Flow routes (vouchers/card/
// reconciliation/admin) are sibling stack screens that push full-screen over the
// tab bar — an agent mid-transaction can't accidentally switch tabs.
export default function AppLayout() {
	const { isAuthenticated, activePosProfileId } = useSession();
	const { scheme } = useThemeMode();
	const t = THEME[scheme];

	if (!isAuthenticated) {
		return <Redirect href="/login" />;
	}
	// Logged in but no working context yet — step 2 of login.
	if (!activePosProfileId) {
		return <Redirect href="/select-profile" />;
	}

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				headerShadowVisible: false,
				headerStyle: { backgroundColor: t.background },
				headerTintColor: t.foreground,
				headerTitleStyle: { fontFamily: FONTS.displaySemiBold, fontSize: 17 },
				contentStyle: { backgroundColor: t.background },
			}}
		>
			<Stack.Screen name="(tabs)" options={{ title: 'Home' }} />
			<Stack.Screen name="vouchers/[voucherNo]" options={{ headerShown: true, title: 'Voucher' }} />
			<Stack.Screen name="card/index" options={{ headerShown: true, title: 'ATM / Bank Card' }} />
			<Stack.Screen
				name="transactions/[id]"
				options={{ headerShown: true, title: 'Transaction' }}
			/>
			<Stack.Screen
				name="reconciliation"
				options={{ headerShown: true, title: 'End-of-Day Reconciliation' }}
			/>
			<Stack.Screen name="admin" />
		</Stack>
	);
}
