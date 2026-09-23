<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { hausi } from '$lib/store.svelte';
	import type { Share } from '$lib/types';

	let share = $state<Share | null>(null);
	let missing = $state(false);
	let taking = $state(false);

	onMount(async () => {
		const id = page.params.id;
		if (!id) {
			missing = true;
			return;
		}
		share = await hausi.loadShare(id);
		missing = !share;
	});

	async function take() {
		if (!share) return;
		if (!hausi.user) {
			goto('/anmelden');
			return;
		}
		if (!hausi.hasSchedule) {
			hausi.ping('Zuerst einen Stundenplan.', 'warn');
			goto('/app/stundenplan');
			return;
		}
		taking = true;
		try {
			await hausi.adoptShare(share);
			goto('/app/aufgaben');
		} finally {
			taking = false;
		}
	}
</script>

<div class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
	<p class="text-xs font-semibold tracking-widest uppercase">Hausi</p>
	{#if !share && !missing}
		<p class="text-muted-foreground mt-4 text-sm">Laden…</p>
	{:else if missing || !share}
		<h1 class="mt-2 text-xl font-semibold">Link ungültig.</h1>
	{:else}
		<p class="text-muted-foreground mt-6 text-xs">{share.subject || 'Ohne Fach'}</p>
		<h1 class="mt-1 text-2xl font-semibold tracking-tight">{share.title}</h1>
		{#if share.details}
			<p class="mt-3 text-sm whitespace-pre-wrap">{share.details}</p>
		{/if}
		<div class="mt-6 flex gap-2">
			<Button onclick={take} disabled={taking}>{taking ? '…' : 'Übernehmen'}</Button>
			<Button variant="ghost" href="/app">Öffnen</Button>
		</div>
	{/if}
</div>
