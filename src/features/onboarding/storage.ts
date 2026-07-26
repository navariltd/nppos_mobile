import AsyncStorage from '@react-native-async-storage/async-storage';

export const FORCE_ONBOARDING = false;

const KEY = 'nppos.onboarding.seen.v1';

export async function hasSeenOnboarding(): Promise<boolean> {
	try {
		return (await AsyncStorage.getItem(KEY)) === '1';
	} catch {
		// Storage unavailable — treat as unseen so the user still gets greeted.
		return false;
	}
}

export async function markOnboardingSeen(): Promise<void> {
	try {
		await AsyncStorage.setItem(KEY, '1');
	} catch {
		// Non-fatal: worst case the walkthrough shows again next launch.
	}
}
