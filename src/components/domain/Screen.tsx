import { cn } from '@/lib/utils';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

// Standard screen container: safe-area aware, optional scroll, padded content.
export function Screen({
	children,
	scroll = true,
	className,
	contentClassName,
	edges = ['top', 'bottom'],
}: {
	children: React.ReactNode;
	scroll?: boolean;
	className?: string;
	contentClassName?: string;
	edges?: Edge[];
}) {
	return (
		<SafeAreaView edges={edges} className={cn('bg-background flex-1', className)}>
			{scroll ? (
				<ScrollView
					className="flex-1"
					contentContainerClassName={cn('gap-4 p-4 pb-8', contentClassName)}
					keyboardShouldPersistTaps="handled"
				>
					{children}
				</ScrollView>
			) : (
				<View className={cn('flex-1 gap-4 p-4', contentClassName)}>{children}</View>
			)}
		</SafeAreaView>
	);
}
