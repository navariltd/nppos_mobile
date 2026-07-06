// Connectivity state via React Context. For the "feel the app" phase this is a
// manual toggle (Profile screen) so we can see how the card/bank flow disables
// itself offline. Later this is backed by @react-native-community/netinfo.

import * as React from 'react';

interface OnlineValue {
	isOnline: boolean;
	toggle: () => void;
	setOnline: (v: boolean) => void;
}

const OnlineContext = React.createContext<OnlineValue | null>(null);

export function OnlineProvider({ children }: { children: React.ReactNode }) {
	const [isOnline, setOnline] = React.useState(true);
	const value = React.useMemo<OnlineValue>(
		() => ({ isOnline, setOnline, toggle: () => setOnline((v) => !v) }),
		[isOnline]
	);
	return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export function useOnline() {
	const ctx = React.useContext(OnlineContext);
	if (!ctx) throw new Error('useOnline must be used within an OnlineProvider');
	return ctx;
}
