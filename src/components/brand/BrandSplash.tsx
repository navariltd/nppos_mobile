// Animated brand splash — plays once on cold start, layered directly over the
// native splash so the handoff is seamless: same orange field, same centered
// motif. The native splash is hidden on our first painted frame, then the motif
// springs in, the wordmark rises, and the whole layer cross-fades into the app.
//
// Purely presentational: it calls onFinish when the animation completes; the
// BootSequence decides what comes next (onboarding or the app).

import { FONTS } from '@/lib/theme';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from 'react-native-reanimated';

const BRAND_ORANGE = '#FD6918';
const CREAM = '#FFF7CD';

export function BrandSplash({ onFinish }: { onFinish: () => void }) {
	const logoScale = useSharedValue(0.72);
	const logoOpacity = useSharedValue(0);
	const haloScale = useSharedValue(0.6);
	const haloOpacity = useSharedValue(0);
	const textOpacity = useSharedValue(0);
	const textY = useSharedValue(14);
	const screenOpacity = useSharedValue(1);

	React.useEffect(() => {
		// Hide the native splash on the next frame — by then our identical layer
		// is already painted, so there's no flash between the two.
		const raf = requestAnimationFrame(() => {
			SplashScreen.hideAsync().catch(() => {});
		});

		// Motif: a soft overshoot then settle.
		logoOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
		logoScale.value = withSequence(
			withTiming(1.06, { duration: 460, easing: Easing.out(Easing.back(1.6)) }),
			withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }),
		);

		// A cream halo breathes out behind the motif.
		haloOpacity.value = withSequence(
			withTiming(0.22, { duration: 500 }),
			withDelay(300, withTiming(0, { duration: 500 })),
		);
		haloScale.value = withTiming(1.15, { duration: 1100, easing: Easing.out(Easing.cubic) });

		// Wordmark rises in.
		textOpacity.value = withDelay(520, withTiming(1, { duration: 420 }));
		textY.value = withDelay(520, withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }));

		// Hold, then cross-fade the whole layer out and hand control back.
		screenOpacity.value = withDelay(
			1650,
			withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }, (done) => {
				if (done) runOnJS(onFinish)();
			}),
		);

		return () => cancelAnimationFrame(raf);
		// Boot-only animation.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
	const logoStyle = useAnimatedStyle(() => ({
		opacity: logoOpacity.value,
		transform: [{ scale: logoScale.value }],
	}));
	const haloStyle = useAnimatedStyle(() => ({
		opacity: haloOpacity.value,
		transform: [{ scale: haloScale.value }],
	}));
	const textStyle = useAnimatedStyle(() => ({
		opacity: textOpacity.value,
		transform: [{ translateY: textY.value }],
	}));

	return (
		<Animated.View style={[StyleSheet.absoluteFill, styles.screen, screenStyle]}>
			<View style={styles.center}>
				<Animated.View style={[styles.halo, haloStyle]} />
				<Animated.Image
					source={require('../../../assets/app-images/nppos-motif.png')}
					style={[styles.logo, logoStyle]}
					resizeMode="contain"
				/>
			</View>
			<Animated.View style={[styles.wordmarkWrap, textStyle]}>
				<Text style={styles.wordmark}>NPPOS</Text>
				<View style={styles.rule} />
				<Text style={styles.tagline}>HDR Disbursement · Field POS</Text>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	screen: {
		backgroundColor: BRAND_ORANGE,
		alignItems: 'center',
		justifyContent: 'center',
	},
	center: {
		alignItems: 'center',
		justifyContent: 'center',
		width: 200,
		height: 200,
	},
	halo: {
		position: 'absolute',
		width: 190,
		height: 190,
		borderRadius: 95,
		backgroundColor: CREAM,
	},
	logo: {
		width: 132,
		height: 132,
	},
	wordmarkWrap: {
		position: 'absolute',
		bottom: 110,
		alignItems: 'center',
	},
	wordmark: {
		fontFamily: FONTS.display,
		color: CREAM,
		fontSize: 34,
		letterSpacing: 6,
	},
	rule: {
		width: 34,
		height: 3,
		borderRadius: 2,
		marginTop: 12,
		marginBottom: 12,
		backgroundColor: 'rgba(255,255,255,0.5)',
	},
	tagline: {
		color: 'rgba(255,247,205,0.82)',
		fontSize: 12.5,
		letterSpacing: 0.5,
	},
});
