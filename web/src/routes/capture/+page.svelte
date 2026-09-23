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

<div class="flex min-h-screen items-start justify-center p-4 pt-5">
	{#if !hausi.ready}
		<div class="bg-popover shadow-float h-40 w-full max-w-lg animate-pulse rounded-2xl border"></div>
	{:else if !hausi.user || !hausi.hasSchedule}
		<div class="bg-popover shadow-float drag w-full max-w-lg rounded-2xl border p-5">
			<p class="text-sm font-medium">{!hausi.user ? 'Bitte zuerst im Hauptfenster anmelden.' : 'Es fehlt noch ein Stundenplan.'}</p>
			<p class="text-muted-foreground mt-1 text-sm">
				{!hausi.user ? 'Danach funktioniert die Schnellerfassung auch offline.' : 'Leg ihn im Hauptfenster unter „Stundenplan“ an.'}
			</p>
			<button type="button" class="no-drag btn btn-outline btn-sm mt-4" onclick={close}>Schließen</button>
		</div>
	{:else}
		<CaptureFlow desktop onDone={close} />
	{/if}
</div>
