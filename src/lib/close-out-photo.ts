// Capturing the shift's close-out photo — the signed distribution sheet or
// fingerprint slip an agent photographs before ending a shift. It rides in the
// pos_closing outbox payload as base64 and the backend attaches it to the POS
// Closing Entry (nppos/sync_handlers.py `_attach_photo`).
//
// Closing is online-only, so the base64 goes out with the push rather than
// being uploaded separately — one request, one idempotency key, no orphan file
// if the push is retried.

import type { ClosingPhoto } from '@/services/api';
import * as ImagePicker from 'expo-image-picker';

export type CapturedPhoto = ClosingPhoto & { uri: string };

// Kept low deliberately: this is a legibility record, not a photograph, and it
// travels inside a JSON payload over a field connection.
const QUALITY = 0.5;

// Base64 inflates by ~4/3, so this caps the payload at roughly 2.7 MB.
const MAX_BASE64_BYTES = 2_000_000;

export const PHOTO_TOO_LARGE =
	'That photo is too large to attach. Retake it from a little further back.';

function toPhoto(asset: ImagePicker.ImagePickerAsset): CapturedPhoto | undefined {
	if (!asset.base64) return undefined;
	if (asset.base64.length > MAX_BASE64_BYTES) return undefined;
	const mime = asset.mimeType ?? 'image/jpeg';
	const ext = mime.split('/')[1] ?? 'jpg';
	return {
		uri: asset.uri,
		name: asset.fileName ?? `close-out.${ext}`,
		mime,
		data: asset.base64,
	};
}

// undefined = the agent backed out, or the image was unusable (the caller shows
// PHOTO_TOO_LARGE when `tooLarge` comes back true).
export type CaptureResult = { photo?: CapturedPhoto; denied?: boolean; tooLarge?: boolean };

export async function capturePhotoFromCamera(): Promise<CaptureResult> {
	const permission = await ImagePicker.requestCameraPermissionsAsync();
	if (!permission.granted) return { denied: true };
	const result = await ImagePicker.launchCameraAsync({
		mediaTypes: ['images'],
		quality: QUALITY,
		base64: true,
		exif: false,
	});
	if (result.canceled) return {};
	const photo = toPhoto(result.assets[0]);
	return photo ? { photo } : { tooLarge: true };
}

export async function pickPhotoFromLibrary(): Promise<CaptureResult> {
	const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
	if (!permission.granted) return { denied: true };
	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ['images'],
		quality: QUALITY,
		base64: true,
		exif: false,
	});
	if (result.canceled) return {};
	const photo = toPhoto(result.assets[0]);
	return photo ? { photo } : { tooLarge: true };
}
