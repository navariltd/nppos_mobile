import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

export const THEME = {
	light: {
		background: 'hsl(210 40% 98%)',
		foreground: 'hsl(222 47% 11%)',

		card: 'hsl(0 0% 100%)',
		cardForeground: 'hsl(222 47% 11%)',

		popover: 'hsl(0 0% 100%)',
		popoverForeground: 'hsl(222 47% 11%)',

		primary: 'hsl(217 91% 60%)',
		primaryForeground: 'hsl(0 0% 100%)',

		secondary: 'hsl(210 40% 94%)',
		secondaryForeground: 'hsl(222 47% 18%)',

		muted: 'hsl(210 40% 96%)',
		mutedForeground: 'hsl(215 16% 47%)',

		accent: 'hsl(214 95% 93%)',
		accentForeground: 'hsl(222 47% 18%)',

		destructive: 'hsl(0 72% 51%)',
		success: 'hsl(142 71% 45%)',
		warning: 'hsl(38 92% 50%)',
		info: 'hsl(199 89% 48%)',

		border: 'hsl(214 32% 91%)',
		input: 'hsl(214 32% 88%)',
		ring: 'hsl(217 91% 60%)',

		radius: '1rem',

		chart1: 'hsl(217 91% 60%)',
		chart2: 'hsl(160 84% 39%)',
		chart3: 'hsl(38 92% 50%)',
		chart4: 'hsl(271 81% 56%)',
		chart5: 'hsl(0 72% 55%)',
	},

	dark: {
		background: 'hsl(222 47% 8%)',
		foreground: 'hsl(210 40% 98%)',

		card: 'hsl(222 40% 11%)',
		cardForeground: 'hsl(210 40% 98%)',

		popover: 'hsl(222 40% 11%)',
		popoverForeground: 'hsl(210 40% 98%)',

		primary: 'hsl(217 91% 68%)',
		primaryForeground: 'hsl(222 47% 8%)',

		secondary: 'hsl(222 28% 17%)',
		secondaryForeground: 'hsl(210 40% 98%)',

		muted: 'hsl(222 24% 15%)',
		mutedForeground: 'hsl(215 20% 70%)',

		accent: 'hsl(222 24% 18%)',
		accentForeground: 'hsl(210 40% 98%)',

		destructive: 'hsl(0 72% 60%)',
		success: 'hsl(142 65% 55%)',
		warning: 'hsl(38 95% 60%)',
		info: 'hsl(199 90% 60%)',

		border: 'hsl(222 22% 20%)',
		input: 'hsl(222 22% 24%)',
		ring: 'hsl(217 91% 68%)',

		radius: '1rem',

		chart1: 'hsl(217 91% 68%)',
		chart2: 'hsl(160 84% 45%)',
		chart3: 'hsl(38 95% 60%)',
		chart4: 'hsl(271 81% 65%)',
		chart5: 'hsl(0 72% 60%)',
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
