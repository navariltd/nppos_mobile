import { Platform, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * This component is used to wrap animated views that should only be animated on native.
 * @param props - The props for the animated view.
 * @returns The animated view if the platform is native, otherwise the children.
 * @example
 * <NativeOnlyAnimatedView entering={FadeIn} exiting={FadeOut}>
 *   <Text>I am only animated on native</Text>
 * </NativeOnlyAnimatedView>
 */
function NativeOnlyAnimatedView(
  props:
    | (React.ComponentProps<typeof Animated.View> & { as?: 'View' })
    | (React.ComponentProps<typeof AnimatedPressable> & { as: 'Pressable' })
) {
  if (Platform.OS === 'web') {
    return <>{props.children as React.ReactNode}</>;
  } else {
    // Reanimated v4's AnimatedProps wrap `key`/`ref` in SharedValue, which JSX
    // spreads reject — cast at the spread site only.
    const { as: _as, ...rest } = props;
    if (props.as === 'Pressable') {
      return <AnimatedPressable {...(rest as object)} />;
    }
    return <Animated.View {...(rest as object)} />;
  }
}

export { NativeOnlyAnimatedView };
