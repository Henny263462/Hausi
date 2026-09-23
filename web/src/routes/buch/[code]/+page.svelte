<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { hausi } from '$lib/store.svelte';

	let status = $state<'wait' | 'ok' | 'fail'>('wait');
	let message = $state('');

	onMount(async () => {
		const code = page.params.code ?? '';
		await hausi.init();
		if (!hausi.user) {
			goto(`/anmelden?next=/buch/${code}`);
			return;
		}
		try {
			await hausi.joinBook(code);
			status = 'ok';
			setTimeout(() => goto('/app'), 900);
		} catch (error) {
			status = 'fail';
			message = error instanceof Error ? error.message : 'Beitreten hat nicht geklappt.';
		}
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-5">
	<a href="/" class="mb-8 flex items-center gap-2.5">
		<span class="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl text-base font-bold">H</span>
		<span class="text-lg font-semibold tracking-tight">Hausi</span>
	</a>
	<div class="card rise w-full max-w-md p-6 text-center">
		{#if status === 'wait'}
			<p class="text-sm font-medium">Buch wird geöffnet …</p>
		{:else if status === 'ok'}
			<p class="text-sm font-medium">Du bist dabei.</p>
		{:else}
			<h1 class="text-lg font-semibold">Einladen hat nicht geklappt</h1>
			<p class="text-muted-foreground mt-2 text-sm">{message}</p>
			<a href="/app/buecher" class="btn btn-primary mt-5">Zu den Büchern</a>
		{/if}
	</div>
</div>
