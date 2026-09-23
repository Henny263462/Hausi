import { hausi } from '$lib/store.svelte';

export function openCapture() {
	if (!hausi.hasSchedule) {
		hausi.ping('Zuerst einen Stundenplan anlegen.', 'warn');
		return;
	}
	if (window.hausiDesktop) window.hausiDesktop.openCapture();
	else hausi.captureOpen = true;
}
