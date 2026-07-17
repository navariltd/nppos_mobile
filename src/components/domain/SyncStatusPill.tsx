import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useOnline } from '@/hooks/online';
import { useSyncCounts } from '@/repositories';
import { cn } from '@/lib/utils';
import { CircleAlert, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated';

// Compact online/offline + pending-outbox indicator for screen headers.
// `onDark` renders it for the evergreen canopy header.
export function SyncStatusPill({ onDark = false }: { onDark?: boolean }) {
	const { isOnline } = useOnline();
	const { pending, conflicts } = useSyncCounts();
	const syncing = isOnline && pending > 0;

	const rotation = useSharedValue(0);
	React.useEffect(() => {
		if (syncing) {
			rotation.value = withRepeat(
				withTiming(360, { duration: 1400, easing: Easing.linear }),
				-1,
			);
		} else {
			cancelAnimation(rotation);
			rotation.value = 0;
		}
	}, [syncing, rotation]);
	const spin = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	const pillBase = 'flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5';

	return (
		<View className="flex-row items-center gap-1.5">
			<View
				className={cn(
					pillBase,
					isOnline
						? onDark
							? 'bg-white/15'
							: 'bg-success/10'
						: onDark
							? 'bg-white/10'
							: 'bg-muted',
				)}
			>
				<Icon
					as={isOnline ? Wifi : WifiOff}
					size={13}
					className={cn(
						isOnline
							? onDark
								? 'text-primary-foreground'
								: 'text-success'
							: onDark
								? 'text-primary-foreground/70'
								: 'text-muted-foreground',
					)}
				/>
				<Text
					className={cn(
						'text-xs font-medium',
						isOnline
							? onDark
								? 'text-primary-foreground'
								: 'text-success'
							: onDark
								? 'text-primary-foreground/70'
								: 'text-muted-foreground',
					)}
				>
					{isOnline ? 'Online' : 'Offline'}
				</Text>
			</View>

			{pending > 0 && (
				<View className={cn(pillBase, onDark ? 'bg-white/15' : 'bg-warning/15')}>
					<Icon
						as={RefreshCw}
						size={13}
						className={onDark ? 'text-primary-foreground' : 'text-warning'}
					/>
					<Text
						className={cn(
							'text-xs font-medium',
							onDark ? 'text-primary-foreground' : 'text-warning',
						)}
					>
						{pending}
					</Text>
				</View>
			)}

			{conflicts > 0 && (
				<View className={cn(pillBase, onDark ? 'bg-white/15' : 'bg-destructive/10')}>
					<Icon
						as={CircleAlert}
						size={13}
						className={onDark ? 'text-primary-foreground' : 'text-destructive'}
					/>
					<Text
						className={cn(
							'text-xs font-medium',
							onDark ? 'text-primary-foreground' : 'text-destructive',
						)}
					>
						{conflicts}
					</Text>
				</View>
			)}
		</View>
	);
}
