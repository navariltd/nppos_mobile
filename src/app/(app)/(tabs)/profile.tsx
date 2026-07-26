import { Screen } from '@/components/domain/Screen';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useOnline } from '@/hooks/online';
import { useActivePosProfile } from '@/hooks/pos-profile';
import { syncNow } from '@/features/sync/engine';
import { closePosSession, useOpenPosSession, useSyncCounts } from '@/repositories';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useSession } from '@/hooks/session';
import { useThemeMode, type ThemeMode } from '@/hooks/theme';
import { initials } from '@/lib/format';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
	ChevronRight,
	CircleAlert,
	CloudOff,
	CloudUpload,
	LockKeyhole,
	LogOut,
	MonitorSmartphone,
	Moon,
	RefreshCw,
	Store,
	Sun,
	Wifi,
	type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

function Row({
	icon,
	iconClassName,
	label,
	value,
	right,
	onPress,
}: {
	icon: LucideIcon;
	iconClassName?: string;
	label: string;
	value?: string;
	right?: React.ReactNode;
	onPress?: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="active:bg-accent/60 flex-row items-center gap-3 px-4 py-3.5"
		>
			<Icon as={icon} size={19} className={iconClassName ?? 'text-foreground/70'} />
			<Text className="flex-1">{label}</Text>
			{value ? <Text className="text-muted-foreground text-sm">{value}</Text> : null}
			{right}
		</Pressable>
	);
}

const Chevron = <Icon as={ChevronRight} size={19} className="text-muted-foreground/60" />;

export default function Profile() {
	const router = useRouter();
	const dispatch = useAppDispatch();
	const isSyncing = useAppSelector((s) => s.sync.isSyncing);
	const { name, role, agent, setRole, signOut } = useSession();
	const { isOnline, deviceOnline, forcedOffline, setForcedOffline } = useOnline();
	const { mode, scheme, setMode } = useThemeMode();
	const { pending, conflicts } = useSyncCounts();
	const openSession = useOpenPosSession();
	const posProfile = useActivePosProfile();

	// Switching the working context mid-shift would orphan the open session's
	// float/expected-cash math — demand a proper close (reconciliation) first.
	const handleSwitchProfile = () => {
		if (openSession) {
			Alert.alert(
				'Session open',
				'Close your POS session (End-of-Day Reconciliation) before switching profiles.',
			);
			return;
		}
		router.push('/select-profile');
	};

	// Never leave a session dangling: sign-out auto-closes it (counted cash
	// defaults to expected, flagged autoClosed) and kicks a sync if online —
	// fire-and-forget; anything unsent stays queued for the next login.
	const handleSignOut = () => {
		if (openSession) {
			closePosSession();
			if (isOnline) {
				dispatch(syncNow())
					.unwrap()
					.catch(() => {});
			}
		}
		signOut();
		router.replace('/login');
	};

	return (
		<Screen edges={['top']}>
			<View>
				<Text variant="h3">Profile</Text>
				<Text className="text-muted-foreground mt-0.5 text-sm">Session · sync · settings</Text>
			</View>

			<Animated.View entering={FadeInDown.duration(300)}>
				<Card>
					<CardContent className="flex-row items-center gap-4 pt-5">
						<Avatar alt={name} className="bg-primary h-16 w-16">
							<AvatarFallback className="bg-primary">
								<Text className="text-primary-foreground font-display text-xl">
									{initials(name)}
								</Text>
							</AvatarFallback>
						</Avatar>
						<View className="flex-1">
							<Text className="font-display-semibold text-lg">{name}</Text>
							<Text className="text-muted-foreground text-sm">
								{agent ? `${agent.email} · ${agent.region}` : ''}
							</Text>
							<Badge variant="secondary" className="mt-1.5 self-start">
								<Text className="capitalize">{role}</Text>
							</Badge>
						</View>
					</CardContent>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(70)}>
				<Card className="overflow-hidden gap-0 py-0">
					<Row
						icon={isOnline ? Wifi : CloudOff}
						iconClassName={isOnline ? 'text-success' : 'text-muted-foreground'}
						label="Connectivity"
						value={
							deviceOnline
								? forcedOffline
									? 'offline (simulated)'
									: 'online'
								: 'no connection'
						}
					/>
					<Separator />
					<Row
						icon={CloudOff}
						iconClassName={forcedOffline ? 'text-warning' : 'text-foreground/70'}
						label="Simulate offline"
						right={<Switch checked={forcedOffline} onCheckedChange={setForcedOffline} />}
					/>
					<Separator />
					<Row
						icon={CloudUpload}
						iconClassName="text-warning"
						label="Pending sync"
						value={`${pending} items`}
					/>
					<Separator />
					<Row
						icon={CircleAlert}
						iconClassName="text-destructive"
						label="Needs review"
						value={`${conflicts} items`}
					/>
					<Separator />
					<Row
						icon={RefreshCw}
						label={isSyncing ? 'Syncing…' : 'Sync now'}
						onPress={async () => {
							if (!isOnline) {
								Alert.alert('Sync', 'Offline — cannot sync right now.');
								return;
							}
							if (isSyncing) return;
							try {
								const r = await dispatch(syncNow()).unwrap();
								Alert.alert(
									'Sync',
									r.pushed + r.conflicts === 0
										? 'Nothing pending — all synced.'
										: `${r.pushed} synced${r.conflicts ? `, ${r.conflicts} need review` : ''}.`,
								);
							} catch (e) {
								Alert.alert(
									'Sync failed',
									(e as { message?: string })?.message ?? 'Try again shortly.',
								);
							}
						}}
						right={Chevron}
					/>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(140)}>
				<Card className="overflow-hidden gap-0 py-0">
					<Row
						icon={scheme === 'dark' ? Moon : Sun}
						label="Appearance"
						value={mode === 'system' ? 'Follows device' : undefined}
					/>
					<View className="px-4 pb-4">
						<Tabs value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
							<TabsList className="h-11 w-full">
								<TabsTrigger value="light" className="flex-1">
									<Icon as={Sun} size={15} className="text-foreground/70" />
									<Text>Light</Text>
								</TabsTrigger>
								<TabsTrigger value="dark" className="flex-1">
									<Icon as={Moon} size={15} className="text-foreground/70" />
									<Text>Dark</Text>
								</TabsTrigger>
								<TabsTrigger value="system" className="flex-1">
									<Icon as={MonitorSmartphone} size={15} className="text-foreground/70" />
									<Text>System</Text>
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</View>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(210)}>
				<Card className="overflow-hidden gap-0 py-0">
					<Row
						icon={Store}
						label="POS profile"
						value={posProfile ? `${posProfile.name} · ${posProfile.warehouse}` : 'none'}
						onPress={handleSwitchProfile}
						right={Chevron}
					/>
					{/* <Separator />
					<Row
						icon={ArrowLeftRight}
						label={`Switch to ${role === 'agent' ? 'admin' : 'agent'} view`}
						onPress={() => setRole(role === 'agent' ? 'admin' : 'agent')}
						right={Chevron}
					/> */}
					<Separator />
					<Row
						icon={LockKeyhole}
						label="Change PIN"
						onPress={() => Alert.alert('Change PIN', 'Not wired up yet.')}
						right={Chevron}
					/>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(280)} className="gap-4">
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="outline">
							<Icon as={LogOut} size={18} className="text-destructive" />
							<Text className="text-destructive">Sign out</Text>
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Sign out</AlertDialogTitle>
							<AlertDialogDescription>
								{openSession
									? `Your POS session is still open — it will be closed and reconciled at the expected cash amount${isOnline ? ' and synced' : ', queued to sync when back online'}. Unsynced work stays safe on this device.`
									: 'End this session? Unsynced work stays safe on this device.'}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>
								<Text>Cancel</Text>
							</AlertDialogCancel>
							<AlertDialogAction className="bg-destructive" onPress={handleSignOut}>
								<Text>Sign out</Text>
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<Text className="text-muted-foreground text-center text-xs">
					{`${Constants.expoConfig?.name} v${Constants.expoConfig?.version}`}
				</Text>
			</Animated.View>
		</Screen>
	);
}
