<script lang="ts">
	import CalendarRange from '@lucide/svelte/icons/calendar-range';
	import Check from '@lucide/svelte/icons/check';
	import Info from '@lucide/svelte/icons/info';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Moon from '@lucide/svelte/icons/moon';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings-2';
	import Sun from '@lucide/svelte/icons/sun';
	import SunMedium from '@lucide/svelte/icons/sun-medium';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import CaptureFlow from '$lib/components/CaptureFlow.svelte';
	import SyncStatus from '$lib/components/SyncStatus.svelte';
	import { openCapture } from '$lib/open';
	import { hausi } from '$lib/store.svelte';
	import { setTheme, theme } from '$lib/theme.svelte';
	import type { Component } from 'svelte';

	let { children } = $props();
	let open = $state(typeof localStorage === 'undefined' || localStorage.getItem('hausi-rail') !== '0');

	const links: { href: string; label: string; icon: Component; count?: () => number }[] = [
		{ href: '/app', label: 'Heute', icon: SunMedium },
		{ href: '/app/aufgaben', label: 'Aufgaben', icon: ListChecks, count: () => hausi.openTasks.length },
		{ href: '/app/notizen', label: 'Notizen', icon: NotebookPen, count: () => hausi.notes.length },
		{ href: '/app/stundenplan', label: 'Stundenplan', icon: CalendarRange },
		{ href: '/app/einstellungen', label: 'Einstellungen', icon: Settings }
	];

	const initial = $derived((hausi.user?.name || hausi.user?.email || '?').trim().charAt(0).toUpperCase());

	function isActive(href: string) {
		return href === '/app' ? page.url.pathname === '/app' : page.url.pathname.startsWith(href);
	}

	function toggleRail() {
		open = !open;
		localStorage.setItem('hausi-rail', open ? '1' : '0');
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || hausi.captureOpen) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		if (event.key === 'n' || event.key === 'N') {
			event.preventDefault();
			openCapture();
			return;
		}
		const index = Number(event.key) - 1;
		if (index >= 0 && index < links.length) {
			event.preventDefault();
			goto(links[index].href);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="min-h-screen {open ? 'md:pl-64' : 'md:pl-[72px]'}" style:transition="padding-left 200ms cubic-bezier(0.2,0.8,0.2,1)">
	<aside
		class="bg-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r md:flex {open ? 'w-64 px-3' : 'w-[72px] px-3'}"
		style:transition="width 200ms cubic-bezier(0.2,0.8,0.2,1)"
	>
		<div class="flex h-16 items-center {open ? 'justify-between' : 'justify-center'}">
			<a href="/app" class="flex items-center gap-2.5 {open ? 'px-1' : ''}" title="Hausi">
				<span class="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg text-sm font-bold tracking-tight">H</span>
				{#if open}
					<span class="leading-tight">
						<span class="block text-sm font-semibold tracking-tight">Hausi</span>
						<span class="text-muted-foreground block text-[11px]">Hausaufgaben</span>
					</span>
				{/if}
			</a>
			{#if open}
				<button type="button" class="btn btn-ghost btn-icon size-8" onclick={toggleRail} title="Einklappen">
					<PanelLeft class="size-4" />
				</button>
			{/if}
		</div>

		{#if !open}
			<button type="button" class="btn btn-ghost btn-icon mx-auto mb-2 size-9" onclick={toggleRail} title="Ausklappen">
				<PanelLeft class="size-4" />
			</button>
		{/if}

		<button
			type="button"
			class="btn btn-primary mb-5 h-10 w-full {open ? 'justify-between px-3' : 'px-0'}"
			disabled={!hausi.hasSchedule}
			title="Neu (N)"
			onclick={openCapture}
		>
			<span class="flex items-center gap-2">
				<Plus class="size-4" />
				{#if open}Neu{/if}
			</span>
			{#if open}<span class="rounded border border-current/25 px-1.5 text-[10px] opacity-70">N</span>{/if}
		</button>

		{#if open}<p class="eyebrow mb-2 px-2">Bereiche</p>{/if}
		<nav class="flex flex-1 flex-col gap-0.5">
			{#each links as link, index}
				{@const Icon = link.icon}
				{@const active = isActive(link.href)}
				{@const count = link.count?.() ?? 0}
				<a
					href={link.href}
					title="{link.label} ({index + 1})"
					class="group relative flex h-9 items-center rounded-lg text-sm {open ? 'gap-2.5 px-2.5' : 'justify-center'} {active
						? 'bg-card text-foreground font-medium shadow-soft'
						: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
				>
					<Icon class="size-[17px] shrink-0" />
					{#if open}
						<span class="flex-1 truncate">{link.label}</span>
						{#if count}
							<span class="tabular text-muted-foreground text-xs">{count}</span>
						{/if}
					{:else if count}
						<span class="bg-foreground absolute top-1.5 right-2 size-1.5 rounded-full"></span>
					{/if}
				</a>
			{/each}
		</nav>

		<div class="flex flex-col gap-1 border-t py-3">
			<SyncStatus compact={!open} />
			<div class="flex items-center gap-1 {open ? '' : 'flex-col'}">
				<a
					href="/app/einstellungen"
					class="hover:bg-accent flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 {open ? '' : 'justify-center'}"
					title={hausi.user?.email}
				>
					<span class="bg-secondary grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold">{initial}</span>
					{#if open}
						<span class="min-w-0 leading-tight">
							<span class="block truncate text-xs font-medium">{hausi.user?.name || 'Profil'}</span>
							<span class="text-muted-foreground block truncate text-[11px]">{hausi.profile?.premium ? 'Premium' : 'Kostenlos'}</span>
						</span>
					{/if}
				</a>
				<button
					type="button"
					class="btn btn-ghost btn-icon size-8"
					title={theme.mode === 'dark' ? 'Hell' : 'Dunkel'}
					onclick={() => setTheme(theme.mode === 'dark' ? 'light' : 'dark')}
				>
					{#if theme.mode === 'dark'}<Sun class="size-4" />{:else}<Moon class="size-4" />{/if}
				</button>
			</div>
		</div>
	</aside>

	<header class="bg-background/85 sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:hidden">
		<a href="/app" class="flex items-center gap-2">
			<span class="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg text-xs font-bold">H</span>
			<span class="text-sm font-semibold">Hausi</span>
		</a>
		<div class="flex items-center gap-1">
			<div class="w-9"><SyncStatus compact /></div>
			<button
				type="button"
				class="btn btn-ghost btn-icon size-9"
				onclick={() => setTheme(theme.mode === 'dark' ? 'light' : 'dark')}
				aria-label="Farbschema"
			>
				{#if theme.mode === 'dark'}<Sun class="size-4" />{:else}<Moon class="size-4" />{/if}
			</button>
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:px-10 md:pt-12 md:pb-16">
		{@render children()}
	</main>

	<nav class="bg-background/90 fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
		{#each links as link}
			{@const Icon = link.icon}
			<a
				href={link.href}
				class="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium {isActive(link.href)
					? 'text-foreground'
					: 'text-muted-foreground'}"
			>
				<Icon class="size-[18px]" />
				{link.label === 'Einstellungen' ? 'Mehr' : link.label === 'Stundenplan' ? 'Plan' : link.label}
			</a>
		{/each}
	</nav>

	<button
		type="button"
		class="bg-primary text-primary-foreground shadow-float fixed right-4 bottom-20 z-20 grid size-14 place-items-center rounded-2xl disabled:opacity-40 md:hidden"
		disabled={!hausi.hasSchedule}
		onclick={openCapture}
		aria-label="Neu"
	>
		<Plus class="size-6" />
	</button>
</div>

{#if hausi.captureOpen}
	<div
		class="animate-in fade-in fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-[2px] duration-150"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) hausi.captureOpen = false;
		}}
	>
		<CaptureFlow onDone={() => (hausi.captureOpen = false)} />
	</div>
{/if}

<div class="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 md:right-6 md:bottom-6 md:left-auto md:translate-x-0">
	{#each hausi.toasts as item (item.id)}
		<div class="card animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 text-sm duration-200">
			<span class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full {item.tone === 'warn' ? 'border-foreground border' : 'bg-foreground text-background'}">
				{#if item.tone === 'warn'}<Info class="size-2.5" />{:else}<Check class="size-2.5" strokeWidth={3} />{/if}
			</span>
			<span class="leading-5">{item.text}</span>
		</div>
	{/each}
</div>
