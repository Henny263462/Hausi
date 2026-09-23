export const DEFAULT_HOTKEY = 'CommandOrControl+Alt+H';
const KEY = 'hausi-hotkey';

export function loadHotkey() {
	if (typeof localStorage === 'undefined') return DEFAULT_HOTKEY;
	return localStorage.getItem(KEY) || DEFAULT_HOTKEY;
}

export function saveHotkey(value: string) {
	localStorage.setItem(KEY, value);
	void window.hausiDesktop?.setHotkey?.(value);
}

export function formatHotkey(accel: string) {
	return accel
		.replaceAll('CommandOrControl', 'Strg')
		.replaceAll('Control', 'Strg')
		.replaceAll('Command', 'Cmd')
		.replaceAll('+', '+');
}

export function eventToAccelerator(event: KeyboardEvent) {
	if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return '';
	const parts: string[] = [];
	if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl');
	if (event.altKey) parts.push('Alt');
	if (event.shiftKey) parts.push('Shift');
	const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
	if (!parts.length) return '';
	parts.push(key);
	return parts.join('+');
}
