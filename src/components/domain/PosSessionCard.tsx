// Shift control on the dashboard. Issuing (cash/goods/card) is blocked until a
// session is open; closing happens on the reconciliation screen. Maps to
// ERPNext POS Opening/Closing Entries — see docs/FRAPPE_BACKEND.md.

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/hooks/currency';
import { useActivePosProfile } from '@/hooks/pos-profile';
import { formatTime } from '@/lib/format';
import { openPosSession, useOpenPosSession, useSessionCashTotal } from '@/repositories';
import { useRouter } from 'expo-router';
import { PlayCircle, StopCircle } from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';

export function PosSessionCard() {
	const router = useRouter();
	const profile = useActivePosProfile();
	const { format, symbol } = useCurrency();
	const session = useOpenPosSession();
	const cashPaid = useSessionCashTotal(session?.id);
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [float, setFloat] = React.useState('');

	const open = () => {
		if (!profile) {
			Alert.alert('Could not open session', 'No active POS profile.');
			return;
		}
		const result = openPosSession(Number(float) || 0, profile.id);
		setDialogOpen(false);
		setFloat('');
		if (!result.ok) Alert.alert('Could not open session', result.reason);
	};

	if (session) {
		return (
			<Card className="border-success/40">
				<CardContent className="flex-row items-center gap-3 py-4">
					<View className="bg-success/10 h-10 w-10 items-center justify-center rounded-xl">
						<Icon as={PlayCircle} size={18} className="text-success" />
					</View>
					<View className="flex-1">
						<Text className="font-medium">Session open · since {formatTime(session.openedAt)}</Text>
						<Text className="text-muted-foreground text-xs">
							Float {format(session.openingFloat)} · paid out {format(cashPaid)}
						</Text>
					</View>
					<Button
						variant="outline"
						size="sm"
						onPress={() => router.push('/reconciliation')}
					>
						<Icon as={StopCircle} size={15} className="text-destructive" />
						<Text>Close</Text>
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card className="border-warning/40 bg-warning/5">
				<CardContent className="flex-row items-center gap-3 py-4">
					<View className="bg-warning/15 h-10 w-10 items-center justify-center rounded-xl">
						<Icon as={StopCircle} size={18} className="text-warning" />
					</View>
					<View className="flex-1">
						<Text className="font-medium">No open POS session</Text>
						<Text className="text-muted-foreground text-xs">
							Open one to start issuing · {profile?.name ?? 'no profile'}
						</Text>
					</View>
					<Button size="sm" onPress={() => setDialogOpen(true)}>
						<Icon as={PlayCircle} size={15} className="text-primary-foreground" />
						<Text>Open</Text>
					</Button>
				</CardContent>
			</Card>

			<AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Open POS session</AlertDialogTitle>
						<AlertDialogDescription>
							Count the cash float you are starting the shift with. This becomes the POS
							Opening Entry when it syncs.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<View className="gap-1.5">
						<Text className="text-muted-foreground text-xs">Opening cash float ({symbol})</Text>
						<Input
							value={float}
							onChangeText={setFloat}
							keyboardType="number-pad"
							placeholder="0"
							className="h-12 rounded-xl"
						/>
					</View>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Text>Cancel</Text>
						</AlertDialogCancel>
						<AlertDialogAction onPress={open}>
							<Text>Open session</Text>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
