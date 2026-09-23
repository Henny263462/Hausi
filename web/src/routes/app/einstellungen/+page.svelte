<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { eventToAccelerator, formatHotkey, loadHotkey, saveHotkey } from '$lib/hotkey';
	import { hausi } from '$lib/store.svelte';
	import { setTheme, theme } from '$lib/theme.svelte';

	let hotkey = $state(loadHotkey());
	let recording = $state(false);
	const desktop = $derived(typeof window !== 'undefined' && !!window.hausiDesktop);

	onMount(() => {
		void window.hausiDesktop?.getHotkey?.().then((value) => {
			if (value) {
				hotkey = value;
				saveHotkey(value);
			}
		});
	});

	function onRecord(event: KeyboardEvent) {
		if (!recording) return;
		event.preventDefault();
		const next = eventToAccelerator(event);
		if (!next) return;
		hotkey = next;
		saveHotkey(next);
		recording = false;
		hausi.ping(`Hotkey: ${formatHotkey(next)}`);
	}
</script>

<svelte:window onkeydown={onRecord} />

<div class="space-y-6">
	<h1 class="text-xl font-semibold tracking-tight">Mehr</h1>
	<div>
		<p class="text-sm">{hausi.user?.name}</p>
		<p class="text-muted-foreground text-xs">{hausi.user?.email}</p>
		<button
			type="button"
			class="mt-2 text-sm underline-offset-2 hover:underline"
			onclick={async () => {
				await hausi.logout();
				goto('/anmelden');
			}}>Abmelden</button
		>
	</div>
	<div class="flex items-center justify-between gap-4">
		<p class="text-sm">Dunkel</p>
		<Switch checked={theme.mode === 'dark'} onCheckedChange={(value) => setTheme(value ? 'dark' : 'light')} />
	</div>
	<div class="flex items-center justify-between gap-4">
		<div>
			<p class="text-sm">Premium</p>
			<p class="text-muted-foreground text-xs">Aufgaben bleiben, sonst 2 Monate.</p>
		</div>
		<Switch checked={!!hausi.profile?.premium} onCheckedChange={(value) => hausi.setPremium(!!value)} />
	</div>
	<div class="flex items-center justify-between gap-4">
		<div>
			<p class="text-sm">Hotkey</p>
			<p class="text-muted-foreground text-xs">{desktop ? 'Öffnet die Schnellerfassung.' : 'Wirkt in der Windows-App.'}</p>
		</div>
		<button type="button" class="text-sm underline-offset-2 hover:underline" onclick={() => (recording = !recording)}>
			{recording ? 'Taste drücken…' : formatHotkey(hotkey)}
		</button>
	</div>
	<p class="text-muted-foreground text-xs leading-5">
		Schließen legt Hausi in den Infobereich. Erinnerungen per E-Mail, sobald Messaging aktiv ist.
	</p>
</div>
