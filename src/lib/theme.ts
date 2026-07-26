import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

// Brand theme — mirrors the CSS variables in global.css (orange primary, navy
// ink, warm neutrals). Keep the two in sync: this drives React Navigation
// chrome, global.css drives the NativeWind utility classes.
export const THEME = {
	light: {
		background: 'hsl(30 40% 98%)',
		foreground: 'hsl(221 44% 14%)',

		card: 'hsl(0 0% 100%)',
		cardForeground: 'hsl(221 44% 14%)',

		popover: 'hsl(0 0% 100%)',
		popoverForeground: 'hsl(221 44% 14%)',

		primary: 'hsl(21 96% 54%)',
		primaryForeground: 'hsl(0 0% 100%)',

		secondary: 'hsl(28 45% 94%)',
		secondaryForeground: 'hsl(221 40% 22%)',

		muted: 'hsl(30 30% 96%)',
		mutedForeground: 'hsl(25 12% 45%)',

		accent: 'hsl(28 100% 93%)',
		accentForeground: 'hsl(221 44% 20%)',

		destructive: 'hsl(0 72% 51%)',
		success: 'hsl(142 71% 42%)',
		warning: 'hsl(38 92% 50%)',
		info: 'hsl(199 89% 48%)',

		border: 'hsl(28 25% 89%)',
		input: 'hsl(28 25% 86%)',
		ring: 'hsl(21 96% 54%)',

		radius: '1rem',

		chart1: 'hsl(21 96% 54%)',
		chart2: 'hsl(221 55% 30%)',
		chart3: 'hsl(38 92% 50%)',
		chart4: 'hsl(160 70% 40%)',
		chart5: 'hsl(271 70% 58%)',
	},

	dark: {
		background: 'hsl(221 42% 9%)',
		foreground: 'hsl(30 30% 96%)',

		card: 'hsl(221 38% 12%)',
		cardForeground: 'hsl(30 30% 96%)',

		popover: 'hsl(221 38% 12%)',
		popoverForeground: 'hsl(30 30% 96%)',

		primary: 'hsl(24 94% 58%)',
		primaryForeground: 'hsl(0 0% 100%)',

		secondary: 'hsl(221 28% 18%)',
		secondaryForeground: 'hsl(30 30% 96%)',

		muted: 'hsl(221 24% 16%)',
		mutedForeground: 'hsl(30 15% 68%)',

		accent: 'hsl(221 24% 19%)',
		accentForeground: 'hsl(30 30% 96%)',

		destructive: 'hsl(0 72% 60%)',
		success: 'hsl(142 65% 52%)',
		warning: 'hsl(38 95% 60%)',
		info: 'hsl(199 90% 60%)',

		border: 'hsl(221 22% 20%)',
		input: 'hsl(221 22% 24%)',
		ring: 'hsl(24 94% 58%)',

		radius: '1rem',

		chart1: 'hsl(24 94% 58%)',
		chart2: 'hsl(221 60% 62%)',
		chart3: 'hsl(38 95% 60%)',
		chart4: 'hsl(160 70% 48%)',
		chart5: 'hsl(271 70% 66%)',
	},
};

export const FONTS = {
	display: 'SpaceGrotesk_700Bold',
	displaySemiBold: 'SpaceGrotesk_600SemiBold',
	displayMedium: 'SpaceGrotesk_500Medium',
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
	light: {
		...DefaultTheme,
		colors: {
			background: THEME.light.background,
			border: THEME.light.border,
			card: THEME.light.card,
			notification: THEME.light.destructive,
			primary: THEME.light.primary,
			text: THEME.light.foreground,
		},
	},
	dark: {
		...DarkTheme,
		colors: {
			background: THEME.dark.background,
			border: THEME.dark.border,
			card: THEME.dark.card,
			notification: THEME.dark.destructive,
			primary: THEME.dark.primary,
			text: THEME.dark.foreground,
		},
	},
};
