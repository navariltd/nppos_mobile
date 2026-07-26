// First-run walkthrough — three brand-styled slides introducing what the app
// does, shown before the login screen. Horizontal paging with progress dots, a
// Skip shortcut, and a primary CTA that advances (and finishes on the last
// slide). Purely presentational: calls onDone when the user skips or gets
// started; BootSequence persists the "seen" flag and moves on.

import { Icon } from '@/components/ui/icon';
import { FONTS } from '@/lib/theme';
import { CloudOff, HandHeart, Ticket, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND } from './palette';

interface Slide {
	icon: LucideIcon;
	title: string;
	body: string;
}

const SLIDES: Slide[] = [
	{
		icon: HandHeart,
		title: 'Reach every beneficiary',
		body: 'Distribute hampers and cash to the families assigned to you, right from the field, one tap at a time.',
	},
	{
		icon: Ticket,
		title: 'Vouchers for walk-ins',
		body: 'No pre-record? Redeem cash or a hamper against a voucher on the spot, validity is checked for you.',
	},
	{
		icon: CloudOff,
		title: 'Works offline, syncs later',
		body: 'Record disbursements with no signal. Everything syncs securely the moment you are back online.',
	},
];

export function Onboarding({ onDone }: { onDone: () => void }) {
	const { width } = useWindowDimensions();
	const scrollRef = React.useRef<ScrollView>(null);
	const [index, setIndex] = React.useState(0);
	const isLast = index === SLIDES.length - 1;

	const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const next = Math.round(e.nativeEvent.contentOffset.x / width);
		if (next !== index) setIndex(next);
	};

	const goNext = () => {
		if (isLast) {
			onDone();
			return;
		}
		scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
		setIndex((i) => i + 1);
	};

	return (
		<View style={styles.root}>
			<SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
				{/* Skip */}
				<View style={styles.topBar}>
					<Pressable hitSlop={12} onPress={onDone} disabled={isLast} style={styles.skipBtn}>
						<Text style={[styles.skipText, isLast && styles.skipHidden]}>Skip</Text>
					</Pressable>
				</View>

				<ScrollView
					ref={scrollRef}
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
					onMomentumScrollEnd={onScroll}
					scrollEventThrottle={16}
				>
					{SLIDES.map((s) => (
						<View key={s.title} style={[styles.slide, { width }]}>
							{/* Fixed-size wrapper always reserves the art's space, so the
							    copy never shifts. Entrances fire once on mount (stable
							    keys) — re-keying on active state would remount an
							    already-visible slide and make it flash. */}
							<View style={styles.artWrap}>
								<View style={styles.artHaloOuter} />
								<View style={styles.artHaloInner} />
								<Animated.View entering={FadeIn.duration(420)} style={styles.artDisc}>
									<Icon as={s.icon} size={64} color={BRAND.cream} strokeWidth={1.6} />
								</Animated.View>
							</View>
							<Animated.View entering={FadeIn.duration(420).delay(90)} style={styles.copy}>
								<Text style={styles.title}>{s.title}</Text>
								<Text style={styles.body}>{s.body}</Text>
							</Animated.View>
						</View>
					))}
				</ScrollView>

				{/* Dots */}
				<View style={styles.dots}>
					{SLIDES.map((s, i) => (
						<View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
					))}
				</View>

				{/* CTA */}
				<View style={styles.ctaWrap}>
					<Pressable
						onPress={goNext}
						style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
					>
						<Text style={styles.ctaText}>{isLast ? 'Get started' : 'Next'}</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: BRAND.orange },
	safe: { flex: 1 },
	topBar: { height: 44, justifyContent: 'center', paddingHorizontal: 20, alignItems: 'flex-end' },
	skipBtn: { paddingVertical: 6, paddingHorizontal: 4 },
	skipText: { color: BRAND.creamSoft, fontSize: 15, fontWeight: '600' },
	skipHidden: { opacity: 0 },

	slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
	artWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
	artHaloOuter: {
		position: 'absolute',
		width: 240,
		height: 240,
		borderRadius: 120,
		backgroundColor: 'rgba(255,255,255,0.08)',
	},
	artHaloInner: {
		position: 'absolute',
		width: 178,
		height: 178,
		borderRadius: 89,
		backgroundColor: 'rgba(255,255,255,0.12)',
	},
	artDisc: {
		width: 128,
		height: 128,
		borderRadius: 34,
		backgroundColor: BRAND.navy,
		alignItems: 'center',
		justifyContent: 'center',
	},

	copy: { alignItems: 'center', marginTop: 44 },
	title: {
		fontFamily: FONTS.display,
		color: '#FFFFFF',
		fontSize: 26,
		textAlign: 'center',
		letterSpacing: 0.2,
	},
	body: {
		color: BRAND.creamSoft,
		fontSize: 15.5,
		lineHeight: 23,
		textAlign: 'center',
		marginTop: 14,
		maxWidth: 320,
	},

	dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 20 },
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: 'rgba(255,255,255,0.35)',
	},
	dotActive: { width: 22, backgroundColor: BRAND.cream },

	ctaWrap: { paddingHorizontal: 24, paddingBottom: 12 },
	cta: {
		height: 54,
		borderRadius: 16,
		backgroundColor: BRAND.cream,
		alignItems: 'center',
		justifyContent: 'center',
	},
	ctaPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
	ctaText: { color: 'white', fontSize: 16.5, fontWeight: '700', letterSpacing: 0.3 },
});
