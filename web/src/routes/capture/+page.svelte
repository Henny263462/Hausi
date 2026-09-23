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

<div class="flex min-h-screen items-start justify-center p-3 pt-4">
	{#if !hausi.ready}
		<p class="text-sm">…</p>
	{:else if !hausi.user}
		<p class="text-sm">Erst im Hauptfenster anmelden. <button type="button" class="underline" onclick={close}>Schließen</button></p>
	{:else if !hausi.hasSchedule}
		<p class="text-sm">Stundenplan fehlt. <button type="button" class="underline" onclick={close}>Schließen</button></p>
	{:else}
		<CaptureFlow desktop onDone={close} />
	{/if}
</div>
