export function formatDateTime(iso?: string) {
	if (!iso) return '—';
	const d = new Date(iso);
	return d.toLocaleString('en-KE', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function formatDate(iso?: string) {
	if (!iso) return '—';
	return new Date(iso).toLocaleDateString('en-KE', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	});
}

export function formatTime(iso?: string) {
	if (!iso) return '—';
	return new Date(iso).toLocaleTimeString('en-KE', {
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function initials(name: string) {
	return name
		.split(' ')
		.map((n) => n[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();
}
