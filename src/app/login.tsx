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
import { AtSign, HeartHandshake, LockKeyhole } from 'lucide-react-native';
import * as React from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
	const { signIn, isSigningIn } = useSession();
	const router = useRouter();
	const [email, setEmail] = React.useState('whitenile@navari.co.ke');
	const [password, setPassword] = React.useState('Training@2026');
	const [role, setRole] = React.useState<Role>('agent');

	// System login via the ApiAdapter (MockAdapter now — any password works).
	// Next stop is choosing the POS profile to work under.
	const onSubmit = async () => {
		const result = await signIn({ email, password, role });
		if (!result.ok) {
			Alert.alert('Sign in', result.reason);
			return;
		}
		router.replace('/select-profile');
	};

	return (
		<View className="bg-primary flex-1">
			<StatusBar style="light" />
			<SafeAreaView edges={['top']} className="flex-1">
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					className="flex-1"
				>
					{/* Scrolls when the keyboard compresses the viewport;
					    persistTaps so "Sign in" works in one tap with the keyboard up. */}
					<ScrollView
						contentContainerClassName="flex-grow"
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
						bounces={false}
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
						className="bg-background flex-1 rounded-t-[28px] px-6 pb-8 pt-8"
					>
						<View className="gap-5">
							<View className="gap-1">
								<Text variant="h4">Sign in</Text>
								<Text className="text-muted-foreground text-sm">
									Use your email and password to start the day.
								</Text>
							</View>

							<View className="gap-2">
								<Label nativeID="email">Email</Label>
								<View className="relative justify-center">
									<View className="absolute left-3 z-10">
										<Icon as={AtSign} size={18} className="text-muted-foreground" />
									</View>
									<Input
										aria-labelledby="email"
										value={email}
										onChangeText={setEmail}
										autoCapitalize="none"
										autoComplete="email"
										keyboardType="email-address"
										className="h-12 pl-10"
									/>
								</View>
							</View>

							<View className="gap-2">
								<Label nativeID="password">Password</Label>
								<View className="relative justify-center">
									<View className="absolute left-3 z-10">
										<Icon as={LockKeyhole} size={18} className="text-muted-foreground" />
									</View>
									<Input
										aria-labelledby="password"
										value={password}
										onChangeText={setPassword}
										placeholder="••••••••"
										secureTextEntry
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

							<Button size="lg" className="mt-1" onPress={onSubmit} disabled={isSigningIn}>
								<Text>{isSigningIn ? 'Signing in…' : 'Sign in'}</Text>
							</Button>

							<Text className="text-muted-foreground text-center text-xs">
								Dummy data build — any password works. First login is online-only.
							</Text>
						</View>
					</Animated.View>
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</View>
	);
}
