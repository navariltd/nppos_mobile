// Boot sequence: the animated splash, then (on first run) the onboarding
// walkthrough, then the app. Both phases render as opaque full-screen overlays
// above the already-mounted app, so when they clear the real UI is right there.
//
// The onboarding decision is made while the splash animates (async flag read),
// so there's no extra blank frame. See ./storage for the FORCE_ONBOARDING
// testing switch that replays the walkthrough on every launch.

import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandSplash } from './BrandSplash';
import { Onboarding } from './Onboarding';
import { FORCE_ONBOARDING, hasSeenOnboarding, markOnboardingSeen } from '@/features/onboarding/storage';

type Phase = 'splash' | 'onboarding' | 'done';

export function BootSequence({ children }: { children: React.ReactNode }) {
	const [phase, setPhase] = React.useState<Phase>('splash');
	// Decided during the splash so the transition is instant.
	const showOnboarding = React.useRef(true);

	React.useEffect(() => {
		let cancelled = false;
		if (FORCE_ONBOARDING) {
			showOnboarding.current = true;
			return;
		}
		hasSeenOnboarding().then((seen) => {
			if (!cancelled) showOnboarding.current = !seen;
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const onSplashFinish = React.useCallback(() => {
		setPhase(showOnboarding.current ? 'onboarding' : 'done');
	}, []);

	const onOnboardingDone = React.useCallback(() => {
		// Best-effort persist; don't block the transition on it.
		void markOnboardingSeen();
		setPhase('done');
	}, []);

	return (
		<View style={styles.root}>
			{children}
			{phase !== 'done' && (
				<View style={StyleSheet.absoluteFill} pointerEvents="auto">
					{phase === 'splash' ? (
						<BrandSplash onFinish={onSplashFinish} />
					) : (
						<Onboarding onDone={onOnboardingDone} />
					)}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
});
