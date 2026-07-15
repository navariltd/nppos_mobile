import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { ChevronRight, Inbox, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSpring,
	withTiming,
	ZoomIn,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Same look as `entering={FadeInDown}` but driven by an animated style.
// Reanimated's entering layout animations can leave nested pressables (e.g.
// dialog triggers) unpainted on the new architecture — wrap those cards in
// this instead.
export function FadeInView({
	delay = 0,
	className,
	children,
}: {
	delay?: number;
	className?: string;
	children: React.ReactNode;
}) {
	const progress = useSharedValue(0);
	React.useEffect(() => {
		progress.value = withDelay(
			delay,
			withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
		);
	}, [delay, progress]);
	const style = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ translateY: (1 - progress.value) * 10 }],
	}));
	return (
		<Animated.View style={style} className={className}>
			{children}
		</Animated.View>
	);
}

// Pressable that springs down slightly — shared press feedback for tiles/rows.
export function PressableScale({
	children,
	className,
	onPress,
	disabled,
}: {
	children: React.ReactNode;
	className?: string;
	onPress?: () => void;
	disabled?: boolean;
}) {
	const scale = useSharedValue(1);
	const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
	return (
		<AnimatedPressable
			onPress={onPress}
			disabled={disabled}
			onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 320 }))}
			onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 320 }))}
			style={style}
			className={className}
		>
			{children}
		</AnimatedPressable>
	);
}

// Big dashboard hub tile (mirrors pos_design.jpeg).
export function ActionTile({
	icon,
	label,
	sublabel,
	onPress,
	disabled,
	className,
	iconClassName,
}: {
	icon: LucideIcon;
	label: string;
	sublabel?: string;
	onPress?: () => void;
	disabled?: boolean;
	/** Tint classes for the icon plate, e.g. "bg-primary/10". */
	className?: string;
	iconClassName?: string;
}) {
	return (
		<PressableScale onPress={onPress} disabled={disabled} className={cn('flex-1', disabled && 'opacity-40')}>
			<View className="bg-card border-border min-h-[124px] justify-between rounded-2xl border p-4 shadow-sm shadow-black/5">
				<View
					className={cn(
						'h-11 w-11 items-center justify-center rounded-xl',
						className ?? 'bg-primary/10',
					)}
				>
					<Icon as={icon} size={22} className={cn('text-primary', iconClassName)} />
				</View>
				<View className="gap-0.5">
					<Text className="font-display-semibold text-[15px] leading-5">{label}</Text>
					{sublabel ? (
						<Text className="text-muted-foreground text-xs leading-4">{sublabel}</Text>
					) : null}
				</View>
			</View>
		</PressableScale>
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
			className={cn('active:bg-accent/60 flex-row items-center gap-3 px-4 py-3.5', className)}
		>
			{leading}
			<View className="flex-1">
				<Text className="font-medium" numberOfLines={1}>
					{title}
				</Text>
				{subtitle ? (
					<Text className="text-muted-foreground mt-0.5 text-sm" numberOfLines={1}>
						{subtitle}
					</Text>
				) : null}
			</View>
			{right ??
				(onPress ? (
					<Icon as={ChevronRight} size={20} className="text-muted-foreground/60" />
				) : null)}
		</Pressable>
	);
}

// Small stat cell for summary rows. Ledger numerals in the display face.
export function Stat({
	label,
	value,
	className,
	valueClassName,
	labelClassName,
}: {
	label: string;
	value: string;
	className?: string;
	valueClassName?: string;
	labelClassName?: string;
}) {
	return (
		<View className={cn('flex-1 gap-0.5', className)}>
			<Text className={cn('font-display text-[22px] leading-7', valueClassName)}>{value}</Text>
			<Text
				className={cn(
					'text-muted-foreground text-[11px] uppercase tracking-wider',
					labelClassName,
				)}
			>
				{label}
			</Text>
		</View>
	);
}

// Uppercase eyebrow that labels a group of cards.
export function SectionLabel({ children, className }: { children: string; className?: string }) {
	return (
		<Text
			className={cn(
				'text-muted-foreground mt-1 text-xs font-semibold uppercase tracking-[2px]',
				className,
			)}
		>
			{children}
		</Text>
	);
}

export function EmptyState({
	icon = Inbox,
	title,
	subtitle,
}: {
	icon?: LucideIcon;
	title: string;
	subtitle?: string;
}) {
	return (
		<View className="items-center justify-center gap-3 px-6 py-16">
			<Animated.View
				entering={ZoomIn.springify().damping(14)}
				className="bg-muted h-16 w-16 items-center justify-center rounded-full"
			>
				<Icon as={icon} size={28} className="text-muted-foreground/70" />
			</Animated.View>
			<View className="items-center gap-1">
				<Text className="font-display-semibold text-base">{title}</Text>
				{subtitle ? (
					<Text className="text-muted-foreground text-center text-sm">{subtitle}</Text>
				) : null}
			</View>
		</View>
	);
}
