// Turning whatever the camera read into a voucher number.
//
// The backend generates the voucher QR itself (nppos: entitlement_voucher.py)
// and encodes `voucher_number` — which is also the doc name, so a clean scan is
// already the voucher no. The generated PNG is attached to the voucher's
// `image` field as `/files/<voucher_number>-qr.png`, so anything carrying that
// path (a scanned link, a pasted url, an older QR that encoded the file url)
// still yields the voucher number. Everything else is normalised here rather
// than at the call sites.

const FILE_SUFFIX = /-qr\.(png|jpe?g|webp|svg)$/i;
const IMAGE_SUFFIX = /\.(png|jpe?g|webp|svg)$/i;
// Query keys a link-style QR might carry the number in (mirrors the web POS's
// /pos/search?voucher=… deep link).
const QUERY_KEYS = ['voucher', 'voucher_no', 'voucher_number', 'name', 'id'];

/**
 * Extract a voucher number from a scanned/pasted value.
 * Returns null when nothing usable is left (blank scan, bare url with no code).
 *
 * A raw voucher number is returned untouched — only values that actually look
 * like a url or an absolute path get split on `/`, because voucher numbers may
 * legitimately contain slashes (`EV/2026/0001`). Note the file-name route is
 * lossy for those: the server writes `/` as `-` in the file name, so the QR
 * content (the number itself) is always the better source.
 */
export function parseVoucherCode(raw: string): string | null {
	let value = (raw ?? '').trim();
	if (!value) return null;

	const isUrl = /^https?:\/\//i.test(value);
	const isPath = value.startsWith('/');

	if (isUrl || isPath) {
		// `?voucher=V-2026-88231` style links win over the path.
		const query = value.split('?')[1]?.split('#')[0];
		if (query) {
			for (const pair of query.split('&')) {
				const [key, val] = pair.split('=');
				if (val && QUERY_KEYS.includes(decodeURIComponent(key).toLowerCase())) {
					return decodeURIComponent(val).trim() || null;
				}
			}
		}
		// Drop query/hash, keep the last segment: `/files/X-qr.png` → `X-qr.png`.
		value = value.split('?')[0].split('#')[0];
		value = value.split('/').filter(Boolean).pop() ?? '';
		try {
			value = decodeURIComponent(value);
		} catch {
			// Not percent-encoded — use it as-is.
		}
	}

	// `<voucherNo>-qr.png` → `<voucherNo>`; a plain image name loses just the ext.
	value = value.replace(FILE_SUFFIX, '').replace(IMAGE_SUFFIX, '').trim();

	return value || null;
}

/**
 * Absolute url for a site-relative Frappe file path (`/files/…`), so the QR
 * image can be rendered in-app. Returns undefined when there's no backend
 * configured (MockAdapter builds) or no path.
 */
export function fileUrl(path?: string | null): string | undefined {
	if (!path) return undefined;
	if (/^https?:\/\//i.test(path)) return path;
	const base = process.env.EXPO_PUBLIC_FRAPPE_URL?.replace(/\/+$/, '');
	if (!base) return undefined;
	return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
