import { cn } from '@/lib/utils';
import * as React from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

// Standard screen container: safe-area aware, optional scroll, padded content.
// Default edges exclude 'top' because most screens sit under a native stack
// header — adding the top inset again creates a dead gap the content scrolls
// under. Tab screens (no header) pass edges={['top']} explicitly.
// Tapping empty space anywhere dismisses the keyboard.
//
// Scrolling screens use KeyboardAwareScrollView (react-native-keyboard-controller)
// so a focused input is always scrolled above the keyboard on both platforms —
// Android is edge-to-edge, where the plain ScrollView never learns the keyboard
// is covering it. Any screen with a text field should go through here.
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
				<KeyboardAwareScrollView
					className="flex-1"
					contentContainerClassName="flex-grow"
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					bottomOffset={24}
				>
					<TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
						<View className={cn('flex-1 gap-4 p-4 pb-12', contentClassName)}>{children}</View>
					</TouchableWithoutFeedback>
				</KeyboardAwareScrollView>
			) : (
				<TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
					<View className={cn('flex-1 gap-4 p-4', contentClassName)}>{children}</View>
				</TouchableWithoutFeedback>
			)}
		</SafeAreaView>
	);
}
