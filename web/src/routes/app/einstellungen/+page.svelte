<script lang="ts">
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Moon from '@lucide/svelte/icons/moon';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Sun from '@lucide/svelte/icons/sun';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SyncStatus from '$lib/components/SyncStatus.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { DEFAULT_HOTKEY, eventToAccelerator, formatHotkey, loadHotkey, saveHotkey } from '$lib/hotkey';
	import { hausi } from '$lib/store.svelte';
	import { setTheme, theme } from '$lib/theme.svelte';

	let hotkey = $state(loadHotkey());
	let recording = $state(false);
	const desktop = $derived(typeof window !== 'undefined' && !!window.hausiDesktop);
	const initial = $derived((hausi.user?.name || hausi.user?.email || '?').trim().charAt(0).toUpperCase());

	onMount(() => {
		void window.hausiDesktop?.getHotkey?.().then((value) => {
			if (value) {
				hotkey = value;
				localStorage.setItem('hausi-hotkey', value);
			}
		});
	});

	function applyHotkey(next: string) {
		hotkey = next;
		saveHotkey(next);
		recording = false;
		hausi.ping(`Hotkey: ${formatHotkey(next)}`);
	}

	function onRecord(event: KeyboardEvent) {
		if (!recording) return;
		event.preventDefault();
		event.stopPropagation();
		if (event.key === 'Escape') {
			recording = false;
			return;
		}
		const next = eventToAccelerator(event);
		if (next) applyHotkey(next);
	}
</script>

<svelte:window onkeydowncapture={onRecord} />

<PageHeader eyebrow="Konto & App" title="Einstellungen" />

<div class="grid gap-4 lg:grid-cols-2">
	<section class="card rise p-5 lg:col-span-2">
		<div class="flex flex-wrap items-center gap-4">
			<span class="bg-primary text-primary-foreground grid size-12 place-items-center rounded-2xl text-lg font-semibold">{initial}</span>
			<div class="min-w-0 flex-1">
				<p class="truncate font-semibold">{hausi.user?.name || 'Ohne Namen'}</p>
				<p class="text-muted-foreground truncate text-sm">{hausi.user?.email}</p>
			</div>
			<button
				type="button"
				class="btn btn-outline"
				onclick={async () => {
					if (hausi.queued && !confirm(`${hausi.queued} Änderungen sind noch nicht synchronisiert und gehen verloren. Trotzdem abmelden?`)) return;
					await hausi.logout();
					goto('/anmelden');
				}}
			>
				<LogOut class="size-4" /> Abmelden
			</button>
		</div>
	</section>

	<section class="card rise p-5">
		<h3 class="text-sm font-semibold">Darstellung</h3>
		<p class="text-muted-foreground mt-0.5 text-sm">Schwarz auf Weiß oder Weiß auf Schwarz.</p>
		<div class="mt-4 grid grid-cols-2 gap-2">
			{#each [{ mode: 'light', label: 'Hell', icon: Sun }, { mode: 'dark', label: 'Dunkel', icon: Moon }] as option}
				{@const Icon = option.icon}
				<button
					type="button"
					class="flex flex-col gap-3 rounded-xl border p-3 text-left {theme.mode === option.mode
						? 'border-foreground ring-foreground/10 ring-4'
						: 'hover:border-foreground/30'}"
					onclick={() => setTheme(option.mode as 'light' | 'dark')}
				>
					<span
						class="flex h-14 items-end gap-1 rounded-lg border p-2 {option.mode === 'dark'
							? 'border-white/10 bg-neutral-900'
							: 'bg-neutral-50'}"
					>
						<span class="h-full w-4 rounded {option.mode === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}"></span>
						<span class="flex flex-1 flex-col gap-1">
							<span class="h-1.5 w-2/3 rounded-full {option.mode === 'dark' ? 'bg-neutral-100' : 'bg-neutral-900'}"></span>
							<span class="h-1.5 w-1/2 rounded-full {option.mode === 'dark' ? 'bg-neutral-600' : 'bg-neutral-300'}"></span>
						</span>
					</span>
					<span class="flex items-center gap-2 text-sm font-medium"><Icon class="size-4" /> {option.label}</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="card rise p-5">
		<h3 class="text-sm font-semibold">Schnellerfassung</h3>
		<p class="text-muted-foreground mt-0.5 text-sm">
			{desktop ? 'Öffnet Hausi von überall in Windows.' : 'Der Hotkey wirkt in der Windows-App. Im Browser: Taste N.'}
		</p>
		<button
			type="button"
			class="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left {recording
				? 'border-foreground ring-foreground/10 ring-4'
				: 'hover:border-foreground/30'}"
			onclick={() => (recording = !recording)}
		>
			<span class="flex items-center gap-3">
				<Keyboard class="text-muted-foreground size-4" />
				<span class="text-sm">{recording ? 'Tastenkombination drücken …' : 'Hotkey'}</span>
			</span>
			<span class="flex gap-1">
				{#if recording}
					<span class="kbd">Esc</span>
				{:else}
					{#each formatHotkey(hotkey).split('+') as key}<span class="kbd h-6 px-2 text-[11px]">{key}</span>{/each}
				{/if}
			</span>
		</button>
		{#if hotkey !== DEFAULT_HOTKEY}
			<button type="button" class="btn btn-ghost btn-sm mt-2" onclick={() => applyHotkey(DEFAULT_HOTKEY)}>
				<RotateCcw class="size-3.5" /> Zurücksetzen
			</button>
		{/if}
	</section>

	<section class="card rise p-5">
		<h3 class="text-sm font-semibold">Offline & Synchronisation</h3>
		<p class="text-muted-foreground mt-0.5 text-sm">
			Nach der ersten Anmeldung funktioniert Hausi ohne Internet. Änderungen werden gesendet, sobald du wieder online bist.
		</p>
		<div class="bg-muted/60 mt-4 flex items-center gap-2 rounded-xl p-1.5">
			<div class="flex-1"><SyncStatus /></div>
			<button type="button" class="btn btn-outline btn-sm" disabled={!hausi.online} onclick={() => hausi.syncNow()}>
				<RefreshCw class="size-3.5 {hausi.syncing ? 'animate-spin' : ''}" /> Jetzt
			</button>
		</div>
	</section>

	<section class="card rise p-5">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h3 class="text-sm font-semibold">Premium</h3>
				<p class="text-muted-foreground mt-0.5 text-sm">
					{hausi.profile?.premium
						? 'Aufgaben bleiben unbegrenzt gespeichert.'
						: 'Kostenlos werden Aufgaben nach 2 Monaten gelöscht.'}
				</p>
			</div>
			<Switch checked={!!hausi.profile?.premium} onCheckedChange={(value) => hausi.setPremium(!!value)} />
		</div>
		<p class="text-muted-foreground mt-4 text-xs leading-5">
			Erinnerungen kommen per E-Mail. Schließen legt die Windows-App in den Infobereich.
		</p>
	</section>
</div>
