<script lang="ts">
	import { goto } from '$app/navigation';
	import Shell from '$lib/components/Shell.svelte';
	import { hausi } from '$lib/store.svelte';

	let { children } = $props();

	$effect(() => {
		if (hausi.ready && !hausi.user) goto('/anmelden');
	});
</script>

{#if !hausi.ready}
	<p class="text-muted-foreground grid min-h-screen place-items-center text-sm">Hausi</p>
{:else if hausi.user}
	<Shell>{@render children()}</Shell>
{/if}
