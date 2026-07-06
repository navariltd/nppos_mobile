import { Text } from '@/components/ui/text';
import { conflictCount, pendingCount } from '@/data/mock';
import { useOnline } from '@/hooks/online';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { View } from 'react-native';

// Compact online/offline + pending-outbox indicator for screen headers.
export function SyncStatusPill() {
	const { isOnline } = useOnline();
	const pending = pendingCount();
	const conflicts = conflictCount();
	return (
		<View className="flex-row items-center gap-2">
			<View
				className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${
					isOnline ? 'bg-emerald-100' : 'bg-muted'
				}`}
			>
				<MaterialIcons
					name={isOnline ? 'cloud-done' : 'cloud-off'}
					size={14}
					color={isOnline ? '#047857' : '#71717a'}
				/>
				<Text className={`text-xs font-medium ${isOnline ? 'text-emerald-700' : 'text-muted-foreground'}`}>
					{isOnline ? 'Online' : 'Offline'}
				</Text>
			</View>
			{pending > 0 && (
				<View className="flex-row items-center gap-1 rounded-full bg-amber-100 px-2 py-1">
					<MaterialIcons name="sync" size={14} color="#b45309" />
					<Text className="text-xs font-medium text-amber-700">{pending}</Text>
				</View>
			)}
			{conflicts > 0 && (
				<View className="flex-row items-center gap-1 rounded-full bg-red-100 px-2 py-1">
					<MaterialIcons name="error-outline" size={14} color="#b91c1c" />
					<Text className="text-xs font-medium text-red-700">{conflicts}</Text>
				</View>
			)}
		</View>
	);
}
