<script lang="ts">
	import CalendarRange from '@lucide/svelte/icons/calendar-range';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Moon from '@lucide/svelte/icons/moon';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings';
	import Sun from '@lucide/svelte/icons/sun';
	import SunMedium from '@lucide/svelte/icons/sun-medium';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { page } from '$app/state';
	import CaptureFlow from '$lib/components/CaptureFlow.svelte';
	import { openCapture } from '$lib/open';
	import { hausi } from '$lib/store.svelte';
	import { setTheme, theme } from '$lib/theme.svelte';
	import type { Component } from 'svelte';

	let { children } = $props();
	let open = $state(false);

	if (typeof localStorage !== 'undefined') {
		open = localStorage.getItem('hausi-rail') === '1';
	}

	const links: { href: string; label: string; icon: Component }[] = [
		{ href: '/app', label: 'Heute', icon: SunMedium },
		{ href: '/app/aufgaben', label: 'Aufgaben', icon: ListChecks },
		{ href: '/app/notizen', label: 'Notizen', icon: NotebookPen },
		{ href: '/app/stundenplan', label: 'Plan', icon: CalendarRange },
		{ href: '/app/einstellungen', label: 'Mehr', icon: Settings }
	];

	function isActive(href: string) {
		return href === '/app' ? page.url.pathname === '/app' : page.url.pathname.startsWith(href);
	}

	function toggleRail() {
		open = !open;
		localStorage.setItem('hausi-rail', open ? '1' : '0');
	}
</script>

<div class="bg-background min-h-screen {open ? 'md:pl-52' : 'md:pl-14'}" style:transition="padding-left 180ms ease">
	<aside
		class="bg-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r py-3 md:flex {open ? 'w-52 px-2' : 'w-14 items-center'}"
		style:transition="width 180ms ease"
	>
		<button type="button" class="mb-3 flex h-9 w-full items-center {open ? 'justify-between px-2' : 'justify-center'}" onclick={toggleRail}>
			<span class="text-[11px] font-semibold tracking-widest uppercase">H</span>
			{#if open}
				<ChevronsLeft class="text-muted-foreground size-4" />
			{:else}
				<span class="sr-only">Ausklappen</span>
			{/if}
		</button>
		{#if !open}
			<button type="button" class="text-muted-foreground mb-2 flex size-8 items-center justify-center rounded-md hover:bg-muted" onclick={toggleRail} title="Ausklappen">
				<ChevronsRight class="size-4" />
			</button>
		{/if}
		<nav class="flex flex-1 flex-col gap-1 {open ? '' : 'items-center'}">
			{#each links as link}
				{@const Icon = link.icon}
				<a
					href={link.href}
					title={link.label}
					class="flex h-9 items-center rounded-md {open ? 'w-full gap-2 px-2' : 'w-9 justify-center'} {isActive(link.href)
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<Icon class="size-4 shrink-0" />
					{#if open}<span class="text-sm">{link.label}</span>{/if}
				</a>
			{/each}
		</nav>
		<button
			type="button"
			class="text-muted-foreground hover:bg-muted hover:text-foreground mb-1 flex h-9 items-center rounded-md {open ? 'w-full gap-2 px-2' : 'w-9 justify-center'}"
			title={theme.mode === 'dark' ? 'Hell' : 'Dunkel'}
			onclick={() => setTheme(theme.mode === 'dark' ? 'light' : 'dark')}
		>
			{#if theme.mode === 'dark'}
				<Sun class="size-4 shrink-0" />
			{:else}
				<Moon class="size-4 shrink-0" />
			{/if}
			{#if open}<span class="text-sm">{theme.mode === 'dark' ? 'Hell' : 'Dunkel'}</span>{/if}
		</button>
		<button
			type="button"
			class="bg-primary text-primary-foreground flex h-9 items-center rounded-md disabled:opacity-40 {open ? 'w-full gap-2 px-2' : 'w-9 justify-center'}"
			disabled={!hausi.hasSchedule}
			title="Neu"
			onclick={openCapture}
		>
			<Plus class="size-4 shrink-0" />
			{#if open}<span class="text-sm">Neu</span>{/if}
		</button>
	</aside>

	<main class="mx-auto max-w-2xl px-4 pt-5 pb-20 md:px-6 md:pt-8 md:pb-10">
		{#if !hausi.online || hausi.queued}
			<p class="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
				{#if !hausi.online}<WifiOff class="size-3.5" /> Offline{/if}
				{#if hausi.queued}{hausi.queued} warten{/if}
			</p>
		{/if}
		{@render children()}
	</main>

	<nav class="bg-background/95 fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t md:hidden">
		{#each links as link}
			{@const Icon = link.icon}
			<a
				href={link.href}
				class="flex flex-col items-center gap-0.5 py-2 text-[10px] {isActive(link.href) ? 'text-foreground' : 'text-muted-foreground'}"
			>
				<Icon class="size-4" />
				{link.label}
			</a>
		{/each}
	</nav>

	<button
		type="button"
		class="bg-primary text-primary-foreground fixed right-4 bottom-16 z-20 flex size-12 items-center justify-center rounded-full shadow md:hidden disabled:opacity-40"
		disabled={!hausi.hasSchedule}
		onclick={openCapture}
		aria-label="Neu"
	>
		<Plus class="size-5" />
	</button>
</div>

{#if hausi.captureOpen}
	<div class="fixed inset-0 z-40 flex items-start justify-center bg-black/60 px-4 pt-[18vh]">
		<CaptureFlow onDone={() => (hausi.captureOpen = false)} />
	</div>
{/if}

<div class="pointer-events-none fixed bottom-20 left-1/2 z-50 flex w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 md:bottom-6">
	{#each hausi.toasts as item (item.id)}
		<div
			class="animate-in fade-in slide-in-from-bottom-2 pointer-events-auto rounded-md px-3 py-2 text-sm duration-150 {item.tone === 'warn'
				? 'bg-secondary text-secondary-foreground'
				: 'bg-primary text-primary-foreground'}"
		>
			{item.text}
		</div>
	{/each}
</div>
