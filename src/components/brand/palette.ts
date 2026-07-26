// Brand constants for the boot experience (splash + onboarding). These come
// from the app logo and are intentionally kept apart from the semantic UI theme
// in src/lib/theme.ts (which is blue): the splash, icons, and walkthrough all
// speak the brand's orange so the first impression is cohesive with the app
// icon a user just tapped.

export const BRAND = {
	orange: '#FD6918',
	orangeDark: '#E4560C',
	navy: '#1B3467',
	cream: '#FFF7CD',
	creamSoft: 'rgba(255,247,205,0.82)',
} as const;
