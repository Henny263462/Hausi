<script lang="ts">
	import CalendarRange from '@lucide/svelte/icons/calendar-range';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings';
	import SunMedium from '@lucide/svelte/icons/sun-medium';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { page } from '$app/state';
	import CaptureFlow from '$lib/components/CaptureFlow.svelte';
	import { hausi } from '$lib/store.svelte';

	let { children } = $props();

	const links = [
		{ href: '/app', label: 'Heute', icon: SunMedium },
		{ href: '/app/aufgaben', label: 'Aufgaben', icon: ListChecks },
		{ href: '/app/notizen', label: 'Notizen', icon: NotebookPen },
		{ href: '/app/stundenplan', label: 'Stundenplan', icon: CalendarRange },
		{ href: '/app/einstellungen', label: 'Einstellungen', icon: Settings }
	];

	function openCapture() {
		if (!hausi.hasSchedule) return;
		if (window.hausiDesktop) window.hausiDesktop.openCapture();
		else hausi.captureOpen = true;
	}
</script>

<div class="mx-auto flex min-h-screen w-full max-w-6xl gap-6 px-4 py-5 md:px-6">
	<aside class="bg-sidebar/80 sticky top-5 hidden h-[calc(100vh-2.5rem)] w-56 shrink-0 flex-col rounded-3xl border p-3 shadow-sm md:flex">
		<div class="px-2 pt-2 pb-4">
			<p class="font-serif text-2xl">Hausi</p>
			<p class="text-muted-foreground text-xs">Hausaufgaben, ohne Umwege</p>
		</div>
		<nav class="flex flex-1 flex-col gap-1">
			{#each links as link}
				{@const Icon = link.icon}
				{@const active = link.href === '/app' ? page.url.pathname === '/app' : page.url.pathname.startsWith(link.href)}
				<a
					href={link.href}
					class="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm {active
						? 'bg-primary text-primary-foreground'
						: 'hover:bg-muted'}"
				>
					<Icon class="size-4" />
					{link.label}
				</a>
			{/each}
		</nav>
		<button
			type="button"
			class="bg-foreground text-background mt-3 inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm disabled:opacity-40"
			disabled={!hausi.hasSchedule}
			onclick={openCapture}
		>
			<Plus class="size-4" /> Neu
		</button>
	</aside>

	<div class="min-w-0 flex-1">
		<header class="mb-5 flex items-center justify-between gap-3">
			<div class="flex items-center gap-2 md:hidden">
				<p class="font-serif text-xl">Hausi</p>
			</div>
			<div class="ml-auto flex items-center gap-2">
				{#if !hausi.online}
					<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">
						<WifiOff class="size-3.5" /> Offline
					</span>
				{/if}
				{#if hausi.queued}
					<span class="bg-muted rounded-full px-2 py-1 text-xs">{hausi.queued} in der Warteschlange</span>
				{/if}
				<span class="text-muted-foreground hidden items-center gap-1 text-xs sm:inline-flex">
					<Keyboard class="size-3.5" /> Strg+Alt+H
				</span>
				<span class="text-sm">{hausi.user?.name || hausi.user?.email}</span>
			</div>
		</header>
		{@render children()}
	</div>
</div>

<nav class="bg-card/95 fixed inset-x-3 bottom-3 z-20 flex justify-around rounded-3xl border p-2 shadow-lg md:hidden">
	{#each links as link}
		{@const Icon = link.icon}
		<a href={link.href} class="text-muted-foreground flex flex-col items-center gap-1 px-2 py-1 text-[10px]">
			<Icon class="size-4" />
			{link.label}
		</a>
	{/each}
</nav>

{#if hausi.captureOpen}
	<div class="fixed inset-0 z-40 flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-sm">
		<CaptureFlow onDone={() => (hausi.captureOpen = false)} />
	</div>
{/if}

{#if hausi.toast}
	<div
		class="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg md:bottom-6 {hausi.toast
			.tone === 'warn'
			? 'bg-amber-100 text-amber-950'
			: 'bg-foreground text-background'}"
	>
		{hausi.toast.text}
	</div>
{/if}
