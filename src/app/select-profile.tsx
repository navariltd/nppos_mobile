// Step 2 of login: pick the POS profile to work under. Reached after
// email/password sign-in (the (app) guard redirects here until one is chosen)
// and again from Profile → "Switch POS profile". The profile's warehouse
// scopes the stock view for the whole session.

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { syncNow } from '@/features/sync/engine';
import { selectIsOnline } from '@/features/sync/slice';
import { useSession } from '@/hooks/session';
import { usePosProfiles } from '@/repositories';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Redirect, useRouter } from 'expo-router';
import { ChevronRight, RefreshCw, Store } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SelectProfile() {
	const router = useRouter();
	const dispatch = useAppDispatch();
	const { isAuthenticated, name, activePosProfileId, selectPosProfile, signOut } = useSession();
	const profiles = usePosProfiles();
	const isSyncing = useAppSelector((s) => s.sync.isSyncing);
	const isOnline = useAppSelector(selectIsOnline);
	// What was active when the screen opened (null on first login, the current
	// profile when switching) — a change means a choice was made.
	const initialId = React.useRef(activePosProfileId).current;

	if (!isAuthenticated) {
		return <Redirect href="/login" />;
	}
	// Declarative exit: the store change itself drives navigation, so choosing
	// always lands on the dashboard regardless of imperative-navigation timing.
	if (activePosProfileId && activePosProfileId !== initialId) {
		return <Redirect href="/" />;
	}

	const choose = (id: string) => {
		if (id === activePosProfileId) {
			// Re-picked the current profile while switching — nothing to change.
			router.replace('/');
			return;
		}
		selectPosProfile(id);
	};

	const isEmpty = profiles.length === 0;

	return (
		<SafeAreaView className="bg-background flex-1">
			<View className="flex-1 gap-6 px-6 pt-12">
				<View className="gap-1">
					<Text variant="h3">Choose a POS profile</Text>
					<Text className="text-muted-foreground text-sm">
						Welcome{name ? `, ${name}` : ''} — pick the profile you are working under
						today. Its warehouse decides which stock you draw from.
					</Text>
				</View>

				<View className="gap-3">
					{profiles.map((p, i) => (
						// Pressable OUTSIDE the entering-animated view: children of
						// layout-animated views can miss touches on Android (Reanimated
						// + New Architecture), and this order also gives press feedback.
						<Pressable key={p.id} onPress={() => choose(p.id)} className="active:opacity-70">
							<Animated.View entering={FadeInDown.duration(300).delay(i * 70)}>
								<Card>
									<CardContent className="flex-row items-center gap-3 py-4">
										<View className="bg-primary/10 h-11 w-11 items-center justify-center rounded-xl">
											<Icon as={Store} size={20} className="text-primary" />
										</View>
										<View className="flex-1">
											<Text className="font-display-semibold">{p.name}</Text>
											<Text className="text-muted-foreground text-xs">
												{p.warehouse} · {p.currency}
											</Text>
										</View>
										<Icon as={ChevronRight} size={19} className="text-muted-foreground/60" />
									</CardContent>
								</Card>
							</Animated.View>
						</Pressable>
					))}
				</View>

				{/* No profiles for this user yet — don't strand them here: let them
				    re-pull (in case the first sync raced login) or sign out. */}
				{isEmpty ? (
					<Card>
						<CardContent className="items-center gap-3 py-8">
							<View className="bg-muted h-14 w-14 items-center justify-center rounded-2xl">
								<Icon as={Store} size={26} className="text-muted-foreground" />
							</View>
							<View className="gap-1">
								<Text className="text-center font-display-semibold">
									No POS profile assigned
								</Text>
								<Text className="text-muted-foreground px-2 text-center text-sm">
									{isOnline
										? 'Nothing came back for your account on the last sync. Ask an admin to assign you a POS profile, then try again.'
										: 'You are offline. Reconnect, then try again to pull your assigned profiles.'}
								</Text>
							</View>
							<Button
								variant="secondary"
								className="mt-1 w-full"
								onPress={() => dispatch(syncNow())}
								disabled={isSyncing || !isOnline}
							>
								{isSyncing ? (
									<ActivityIndicator size="small" />
								) : (
									<Icon as={RefreshCw} size={16} />
								)}
								<Text>{isSyncing ? 'Checking…' : 'Try again'}</Text>
							</Button>
						</CardContent>
					</Card>
				) : null}
			</View>

			{/* Always give an escape from this screen — the only other exit is
			    picking a profile, which a user without one cannot do. */}
			<View className="border-border/60 border-t px-6 py-4">
				<Button variant="ghost" onPress={signOut}>
					<Text className="text-muted-foreground">Sign out</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}
