<script lang="ts">
	import { goto } from '$app/navigation';
	import Shell from '$lib/components/Shell.svelte';
	import { hausi } from '$lib/store.svelte';

	let { children } = $props();

	$effect(() => {
		if (hausi.ready && !hausi.user) goto('/anmelden');
	});
</script>

{#if hausi.user}
	<Shell>{@render children()}</Shell>
{/if}
