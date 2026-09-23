<script lang="ts">
	import { onMount } from 'svelte';
	import { hausi } from '$lib/store.svelte';
	import { syncTheme } from '$lib/theme.svelte';
	import './layout.css';

	let { children } = $props();

	onMount(() => {
		syncTheme();
		void hausi.init();
	});
</script>

<svelte:head>
	<title>Hausi</title>
</svelte:head>

{@render children()}
