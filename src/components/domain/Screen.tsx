import { cn } from '@/lib/utils';
import * as React from 'react';
import { Keyboard, ScrollView, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

// Standard screen container: safe-area aware, optional scroll, padded content.
// Default edges exclude 'top' because most screens sit under a native stack
// header — adding the top inset again creates a dead gap the content scrolls
// under. Tab screens (no header) pass edges={['top']} explicitly.
// Tapping empty space anywhere dismisses the keyboard.
export function Screen({
	children,
	scroll = true,
	className,
	contentClassName,
	edges = ['bottom'],
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
					contentContainerClassName="flex-grow"
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					automaticallyAdjustKeyboardInsets
				>
					<TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
						<View className={cn('flex-1 gap-4 p-4 pb-12', contentClassName)}>{children}</View>
					</TouchableWithoutFeedback>
				</ScrollView>
			) : (
				<TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
					<View className={cn('flex-1 gap-4 p-4', contentClassName)}>{children}</View>
				</TouchableWithoutFeedback>
			)}
		</SafeAreaView>
	);
}
