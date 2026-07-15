import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useSession } from '@/hooks/session';
import type { Role } from '@/types/domain';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { HeartHandshake, LockKeyhole, ScanLine } from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
	const { signIn } = useSession();
	const router = useRouter();
	const [agentId, setAgentId] = React.useState('WH-NRB-014');
	const [pin, setPin] = React.useState('');
	const [role, setRole] = React.useState<Role>('agent');

	const onSubmit = () => {
		signIn(role);
		router.replace('/');
	};

	return (
		<View className="bg-primary flex-1">
			<StatusBar style="light" />
			<SafeAreaView edges={['top']} className="flex-1">
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					className="flex-1"
				>
					{/* Canopy hero */}
					<View className="items-center gap-4 px-6 pb-10 pt-12">
						<Animated.View
							entering={FadeInDown.duration(400)}
							className="h-16 w-16 items-center justify-center rounded-2xl bg-white/10"
						>
							<Icon as={HeartHandshake} size={32} className="text-primary-foreground" />
						</Animated.View>
						<Animated.View entering={FadeInDown.duration(400).delay(80)} className="items-center">
							<Text className="text-primary-foreground font-display text-4xl tracking-tight">
								NPPOS
							</Text>
							<Text className="text-primary-foreground/70 mt-1 text-sm">
								HDR Disbursement · Field POS
							</Text>
						</Animated.View>
					</View>

					{/* Paper panel */}
					<Animated.View
						entering={FadeInUp.duration(420).delay(120)}
						className="bg-background flex-1 rounded-t-[28px] px-6 pt-8"
					>
						<View className="gap-5">
							<View className="gap-1">
								<Text variant="h4">Sign in</Text>
								<Text className="text-muted-foreground text-sm">
									Use your warehouse ID and PIN to start the day.
								</Text>
							</View>

							<View className="gap-2">
								<Label nativeID="agentId">Agent / Warehouse ID</Label>
								<View className="relative justify-center">
									<View className="absolute left-3 z-10">
										<Icon as={ScanLine} size={18} className="text-muted-foreground" />
									</View>
									<Input
										aria-labelledby="agentId"
										value={agentId}
										onChangeText={setAgentId}
										autoCapitalize="characters"
										className="h-12 pl-10"
									/>
								</View>
							</View>

							<View className="gap-2">
								<Label nativeID="pin">PIN</Label>
								<View className="relative justify-center">
									<View className="absolute left-3 z-10">
										<Icon as={LockKeyhole} size={18} className="text-muted-foreground" />
									</View>
									<Input
										aria-labelledby="pin"
										value={pin}
										onChangeText={setPin}
										placeholder="••••"
										keyboardType="number-pad"
										secureTextEntry
										maxLength={6}
										className="h-12 pl-10"
									/>
								</View>
							</View>

							<View className="gap-2">
								<Label>Sign in as</Label>
								<Tabs value={role} onValueChange={(v) => setRole(v as Role)}>
									<TabsList className="h-11 w-full">
										<TabsTrigger value="agent" className="flex-1">
											<Text>Agent</Text>
										</TabsTrigger>
										<TabsTrigger value="admin" className="flex-1">
											<Text>Admin</Text>
										</TabsTrigger>
									</TabsList>
								</Tabs>
							</View>

							<Button size="lg" className="mt-1" onPress={onSubmit}>
								<Text>Sign in</Text>
							</Button>

							<Text className="text-muted-foreground text-center text-xs">
								Dummy data build — any PIN works. First login is online-only.
							</Text>
						</View>
					</Animated.View>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</View>
	);
}
