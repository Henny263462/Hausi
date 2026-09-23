<script lang="ts">
	import { goto } from '$app/navigation';
	import { hausi } from '$lib/store.svelte';

	$effect(() => {
		if (!hausi.ready) return;
		goto(hausi.user ? '/app' : '/anmelden');
	});
</script>

<div class="grid min-h-screen place-items-center">
	<span class="bg-primary text-primary-foreground grid size-10 animate-pulse place-items-center rounded-xl font-bold">H</span>
</div>
