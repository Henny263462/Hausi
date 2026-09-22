<script lang="ts">
	import { onMount } from 'svelte';
	import { hausi } from '$lib/store.svelte';
	import './layout.css';

	let { children } = $props();

	onMount(() => {
		void hausi.init();
	});
</script>

<svelte:head>
	<title>Hausi</title>
</svelte:head>

{@render children()}
