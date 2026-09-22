<script lang="ts">
	import { goto } from '$app/navigation';
	import { hausi } from '$lib/store.svelte';

	$effect(() => {
		if (!hausi.ready) return;
		goto(hausi.user ? '/app' : '/anmelden');
	});
</script>

<p class="text-muted-foreground p-8 text-sm">Einen Moment…</p>
