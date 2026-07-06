import { Screen } from '@/components/domain/Screen';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { conflictCount, currentAgent, pendingCount } from '@/data/mock';
import { useOnline } from '@/hooks/online';
import { useSession } from '@/hooks/session';
import { initials } from '@/lib/format';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Switch, View } from 'react-native';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function Row({
	icon,
	label,
	value,
	right,
	onPress,
}: {
	icon: IconName;
	label: string;
	value?: string;
	right?: React.ReactNode;
	onPress?: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="flex-row items-center gap-3 px-4 py-3 active:bg-accent"
		>
			<MaterialIcons name={icon} size={20} color="#3f3f46" />
			<Text className="flex-1">{label}</Text>
			{value ? <Text className="text-muted-foreground text-sm">{value}</Text> : null}
			{right}
		</Pressable>
	);
}

export default function Profile() {
	const router = useRouter();
	const { name, role, setRole, signOut } = useSession();
	const { isOnline, toggle } = useOnline();

	const onLogout = () =>
		Alert.alert('Sign out', 'End this session?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Sign out',
				style: 'destructive',
				onPress: () => {
					signOut();
					router.replace('/login');
				},
			},
		]);

	return (
		<Screen edges={['top']}>
			<View>
				<Text variant="h3">Profile</Text>
				<Text className="text-muted-foreground text-sm">Session · sync · settings</Text>
			</View>

			<Card>
				<CardContent className="flex-row items-center gap-4 pt-6">
					<Avatar alt={name} className="h-14 w-14">
						<AvatarFallback>
							<Text className="text-lg font-semibold">{initials(name)}</Text>
						</AvatarFallback>
					</Avatar>
					<View className="flex-1">
						<Text className="text-lg font-semibold">{name}</Text>
						<Text className="text-muted-foreground text-sm">
							{currentAgent.code} · {currentAgent.region}
						</Text>
						<View className="bg-secondary mt-1 self-start rounded-full px-2 py-0.5">
							<Text className="text-secondary-foreground text-xs font-medium capitalize">
								{role}
							</Text>
						</View>
					</View>
				</CardContent>
			</Card>

			<Card className="overflow-hidden py-0">
				<Row
					icon={isOnline ? 'cloud-done' : 'cloud-off'}
					label="Connectivity"
					right={<Switch value={isOnline} onValueChange={toggle} />}
				/>
				<Separator />
				<Row icon="sync" label="Pending sync" value={`${pendingCount()} items`} />
				<Separator />
				<Row icon="error-outline" label="Needs review" value={`${conflictCount()} items`} />
				<Separator />
				<Row
					icon="refresh"
					label="Sync now"
					onPress={() =>
						Alert.alert(
							'Sync',
							isOnline ? 'Flushing outbox… (stub)' : 'Offline — cannot sync right now.'
						)
					}
					right={<MaterialIcons name="chevron-right" size={20} color="#a1a1aa" />}
				/>
			</Card>

			<Card className="overflow-hidden py-0">
				<Row
					icon="swap-horiz"
					label={`Switch to ${role === 'agent' ? 'admin' : 'agent'} view`}
					onPress={() => setRole(role === 'agent' ? 'admin' : 'agent')}
					right={<MaterialIcons name="chevron-right" size={20} color="#a1a1aa" />}
				/>
				<Separator />
				<Row
					icon="lock-outline"
					label="Change PIN"
					onPress={() => Alert.alert('Change PIN', 'Not wired up yet.')}
					right={<MaterialIcons name="chevron-right" size={20} color="#a1a1aa" />}
				/>
			</Card>

			<Button variant="outline" onPress={onLogout}>
				<MaterialIcons name="logout" size={18} color="#dc2626" />
				<Text className="text-destructive">Sign out</Text>
			</Button>

			<Text className="text-muted-foreground text-center text-xs">
				NPPOS v1.0.0 · dummy-data build
			</Text>
		</Screen>
	);
}
