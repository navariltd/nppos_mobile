import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useSession } from '@/hooks/session';
import type { Role } from '@/types/domain';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
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
		<SafeAreaView className="bg-background flex-1">
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				className="flex-1 justify-center gap-8 p-6"
			>
				<View className="items-center gap-3">
					<View className="bg-primary h-16 w-16 items-center justify-center rounded-2xl">
						<MaterialIcons name="volunteer-activism" size={30} color="#fff" />
					</View>
					<View className="items-center">
						<Text variant="h2" className="border-0 pb-0">
							NPPOS
						</Text>
						<Text className="text-muted-foreground">HDR Disbursement · Field POS</Text>
					</View>
				</View>

				<Card>
					<CardContent className="gap-4 pt-6">
						<View className="gap-1.5">
							<Text className="text-sm font-medium">Agent / Warehouse ID</Text>
							<Input value={agentId} onChangeText={setAgentId} autoCapitalize="characters" />
						</View>
						<View className="gap-1.5">
							<Text className="text-sm font-medium">PIN</Text>
							<Input
								value={pin}
								onChangeText={setPin}
								placeholder="••••"
								keyboardType="number-pad"
								secureTextEntry
								maxLength={6}
							/>
						</View>

						<View className="gap-1.5">
							<Text className="text-sm font-medium">Sign in as</Text>
							<View className="flex-row gap-2">
								<Button
									variant={role === 'agent' ? 'default' : 'outline'}
									className="flex-1"
									onPress={() => setRole('agent')}
								>
									<Text>Agent</Text>
								</Button>
								<Button
									variant={role === 'admin' ? 'default' : 'outline'}
									className="flex-1"
									onPress={() => setRole('admin')}
								>
									<Text>Admin</Text>
								</Button>
							</View>
						</View>

						<Button className="mt-2" onPress={onSubmit}>
							<Text>Sign in</Text>
						</Button>
					</CardContent>
				</Card>

				<Text className="text-muted-foreground text-center text-xs">
					Dummy data build — any PIN works. First login is online-only.
				</Text>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}
