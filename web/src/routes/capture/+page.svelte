<script lang="ts">
	import { onMount } from 'svelte';
	import CaptureFlow from '$lib/components/CaptureFlow.svelte';
	import { hausi } from '$lib/store.svelte';

	function close() {
		window.hausiDesktop?.closeCapture();
	}

	onMount(() => {
		document.documentElement.classList.add('capture-mode');
		document.body.classList.add('capture-mode');
		return () => {
			document.documentElement.classList.remove('capture-mode');
			document.body.classList.remove('capture-mode');
		};
	});
</script>

<div class="flex min-h-screen items-start justify-center bg-transparent p-3 pt-4">
	{#if !hausi.ready}
		<p class="text-sm">Lädt…</p>
	{:else if !hausi.user}
		<section class="bg-card w-full max-w-md rounded-3xl border p-5 shadow-2xl">
			<h1 class="font-serif text-2xl">Erst anmelden</h1>
			<p class="text-muted-foreground mt-2 text-sm">Melde dich im Hauptfenster an. Danach kannst du hier direkt erfassen.</p>
			<button type="button" class="text-primary mt-4 text-sm" onclick={close}>Schließen</button>
		</section>
	{:else if !hausi.hasSchedule}
		<section class="bg-card w-full max-w-md rounded-3xl border p-5 shadow-2xl">
			<h1 class="font-serif text-2xl">Stundenplan fehlt</h1>
			<p class="text-muted-foreground mt-2 text-sm">Leg im Hauptfenster zuerst einen Stundenplan an.</p>
			<button type="button" class="text-primary mt-4 text-sm" onclick={close}>Schließen</button>
		</section>
	{:else}
		<CaptureFlow desktop onDone={close} />
	{/if}
</div>

<style>
	:global(body.capture-mode) {
		background: transparent !important;
		background-image: none !important;
	}
</style>
