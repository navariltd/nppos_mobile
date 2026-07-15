// Theme mode (light / dark / system) via React Context, driving NativeWind's
// color scheme so every `dark:` class flips at once. Like the online toggle,
// this is in-memory for now — persistence lands with redux-persist.

import { useColorScheme } from 'nativewind';
import * as React from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeModeValue {
	/** What the user picked (may be 'system'). */
	mode: ThemeMode;
	/** What is actually rendered right now. */
	scheme: 'light' | 'dark';
	setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = React.createContext<ThemeModeValue | null>(null);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
	const { colorScheme, setColorScheme } = useColorScheme();
	const [mode, setModeState] = React.useState<ThemeMode>('system');

	const setMode = React.useCallback(
		(next: ThemeMode) => {
			setModeState(next);
			setColorScheme(next);
		},
		[setColorScheme]
	);

	const value = React.useMemo<ThemeModeValue>(
		() => ({ mode, scheme: colorScheme ?? 'light', setMode }),
		[mode, colorScheme, setMode]
	);

	return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
	const ctx = React.useContext(ThemeModeContext);
	if (!ctx) throw new Error('useThemeMode must be used within a ThemeModeProvider');
	return ctx;
}
