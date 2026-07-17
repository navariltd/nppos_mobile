import { defineConfig } from 'drizzle-kit';

// This config is only read by the drizzle-kit CLI on your machine (generate).
// It must stay Node-safe — never import expo-* modules here, they can't load
// outside the app and would break `npx drizzle-kit generate`.
//
// `drizzle-kit studio` cannot reach the DB either: the file lives inside the
// app sandbox on the phone/simulator. Use the in-app bridge instead
// (useDrizzleStudio in src/db/provider.tsx): run `npx expo start`, press
// shift+m, pick expo-drizzle-studio-plugin — studio opens against live device
// data.
export default defineConfig({
	dialect: 'sqlite',
	driver: 'expo',
	schema: './src/db/schema.ts',
	out: './src/db/migrations',
});
