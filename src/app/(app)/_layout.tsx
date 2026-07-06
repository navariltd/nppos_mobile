import { useSession } from '@/hooks/session';
import { Redirect, Stack } from 'expo-router';

// Auth guard for the whole authenticated app. Flow routes (vouchers/goods/card/
// reconciliation/admin) are sibling stack screens that push full-screen over the
// tab bar — an agent mid-transaction can't accidentally switch tabs.
export default function AppLayout() {
	const { isAuthenticated } = useSession();

	if (!isAuthenticated) {
		return <Redirect href="/login" />;
	}

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="vouchers/index" options={{ headerShown: true, title: 'Cash Vouchers' }} />
			<Stack.Screen name="vouchers/[voucherNo]" options={{ headerShown: true, title: 'Voucher' }} />
			<Stack.Screen name="goods/index" options={{ headerShown: true, title: 'Goods / Hampers' }} />
			<Stack.Screen
				name="goods/issue/[entitlementId]"
				options={{ headerShown: true, title: 'Confirm Issue', presentation: 'modal' }}
			/>
			<Stack.Screen name="card/index" options={{ headerShown: true, title: 'ATM / Bank Card' }} />
			<Stack.Screen
				name="card/withdraw"
				options={{ headerShown: true, title: 'Withdraw', presentation: 'modal' }}
			/>
			<Stack.Screen
				name="beneficiaries/[id]"
				options={{ headerShown: true, title: 'Beneficiary' }}
			/>
			<Stack.Screen
				name="reconciliation"
				options={{ headerShown: true, title: 'End-of-Day Reconciliation' }}
			/>
			<Stack.Screen name="admin" />
		</Stack>
	);
}
