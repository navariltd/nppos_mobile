import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Big dashboard hub tile (mirrors pos_design.jpeg).
export function ActionTile({
	icon,
	label,
	sublabel,
	onPress,
	disabled,
	tint = '#0f172a',
}: {
	icon: IconName;
	label: string;
	sublabel?: string;
	onPress?: () => void;
	disabled?: boolean;
	tint?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			className={cn('flex-1', disabled && 'opacity-40')}
		>
			<Card className="min-h-[112px] justify-between gap-2 py-4">
				<View
					className="h-9 w-9 items-center justify-center rounded-full"
					style={{ backgroundColor: `${tint}1A` }}
				>
					<MaterialIcons name={icon} size={20} color={tint} />
				</View>
				<View className="px-0.5">
					<Text className="font-semibold">{label}</Text>
					{sublabel ? (
						<Text className="text-muted-foreground text-xs">{sublabel}</Text>
					) : null}
				</View>
			</Card>
		</Pressable>
	);
}

// A tappable list row inside a Card list.
export function ListRow({
	title,
	subtitle,
	right,
	onPress,
	leading,
	className,
}: {
	title: string;
	subtitle?: string;
	right?: React.ReactNode;
	onPress?: () => void;
	leading?: React.ReactNode;
	className?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			className={cn('flex-row items-center gap-3 px-4 py-3 active:bg-accent', className)}
		>
			{leading}
			<View className="flex-1">
				<Text className="font-medium" numberOfLines={1}>
					{title}
				</Text>
				{subtitle ? (
					<Text className="text-muted-foreground text-sm" numberOfLines={1}>
						{subtitle}
					</Text>
				) : null}
			</View>
			{right ?? (onPress ? <MaterialIcons name="chevron-right" size={22} color="#a1a1aa" /> : null)}
		</Pressable>
	);
}

// Small stat cell for summary rows.
export function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
	return (
		<View className={cn('flex-1', className)}>
			<Text className="text-xl font-semibold">{value}</Text>
			<Text className="text-muted-foreground text-xs">{label}</Text>
		</View>
	);
}

export function EmptyState({
	icon = 'inbox',
	title,
	subtitle,
}: {
	icon?: IconName;
	title: string;
	subtitle?: string;
}) {
	return (
		<View className="items-center justify-center gap-2 py-16">
			<MaterialIcons name={icon} size={40} color="#d4d4d8" />
			<Text className="font-medium">{title}</Text>
			{subtitle ? (
				<Text className="text-muted-foreground text-center text-sm">{subtitle}</Text>
			) : null}
		</View>
	);
}
