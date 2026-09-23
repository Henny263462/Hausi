export const theme = $state({ mode: 'light' as 'light' | 'dark' });

export function syncTheme() {
	if (typeof document === 'undefined') return;
	theme.mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(mode: 'light' | 'dark') {
	theme.mode = mode;
	document.documentElement.classList.toggle('dark', mode === 'dark');
	localStorage.setItem('hausi-theme', mode);
}
