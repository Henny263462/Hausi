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
	<div class="grid min-h-screen place-items-center">
		<span class="bg-primary text-primary-foreground grid size-10 animate-pulse place-items-center rounded-xl font-bold">H</span>
	</div>
{:else if hausi.user}
	<Shell>{@render children()}</Shell>
{/if}
