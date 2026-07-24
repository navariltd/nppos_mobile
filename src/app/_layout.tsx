import '../../global.css';

import { DbProvider } from '@/db/provider';
import { SyncManager } from '@/features/sync/SyncManager';
import { ThemeModeProvider, useThemeMode } from '@/hooks/theme';
import { StoreProvider } from '@/store/provider';
import { FONTS, NAV_THEME, THEME } from '@/lib/theme';
import {
	SpaceGrotesk_500Medium,
	SpaceGrotesk_600SemiBold,
	SpaceGrotesk_700Bold,
	useFonts,
} from '@expo-google-fonts/space-grotesk';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export {
	// Catch any errors thrown by the Layout component.
	ErrorBoundary,
} from 'expo-router';

// Sits inside ThemeModeProvider so nav chrome re-themes with the scheme.
function RootNavigator() {
	const { scheme } = useThemeMode();
	const t = THEME[scheme];

	return (
		<ThemeProvider value={NAV_THEME[scheme]}>
			<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
			<Stack
				screenOptions={{
					headerShown: false,
					headerShadowVisible: false,
					headerStyle: { backgroundColor: t.background },
					headerTintColor: t.foreground,
					headerTitleStyle: {
						fontFamily: FONTS.displaySemiBold,
						fontSize: 17,
					},
					contentStyle: { backgroundColor: t.background },
				}}
			>
				<Stack.Screen name="(app)" />
				<Stack.Screen name="login" options={{ animation: 'fade' }} />
				<Stack.Screen name="select-profile" options={{ animation: 'fade' }} />
				<Stack.Screen name="+not-found" />
			</Stack>
			<PortalHost />
		</ThemeProvider>
	);
}

export default function RootLayout() {
	const [fontsLoaded] = useFonts({
		SpaceGrotesk_500Medium,
		SpaceGrotesk_600SemiBold,
		SpaceGrotesk_700Bold,
	});

	// Hold a blank frame while the display font loads; StoreProvider's
	// PersistGate holds the tree until the persisted session rehydrates.
	if (!fontsLoaded) {
		return null;
	}

	return (
		<SafeAreaProvider>
			<StoreProvider>
				<DbProvider>
					<ThemeModeProvider>
						{/* below DbProvider — the sync engine reads SQLite */}
						<SyncManager />
						<RootNavigator />
					</ThemeModeProvider>
				</DbProvider>
			</StoreProvider>
		</SafeAreaProvider>
	);
}
