import '../../global.css';

import { OnlineProvider } from '@/hooks/online';
import { SessionProvider } from '@/hooks/session';
import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export {
	// Catch any errors thrown by the Layout component.
	ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<SessionProvider>
				<OnlineProvider>
					<ThemeProvider value={NAV_THEME['light']}>
						<StatusBar style="dark" />
						<Stack screenOptions={{ headerShown: false }}>
							<Stack.Screen name="(app)" />
							<Stack.Screen
								name="login"
								options={{ animation: 'fade' }}
							/>
							<Stack.Screen name="+not-found" />
						</Stack>
						<PortalHost />
					</ThemeProvider>
				</OnlineProvider>
			</SessionProvider>
		</SafeAreaProvider>
	);
}
