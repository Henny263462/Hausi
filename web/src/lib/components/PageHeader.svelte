<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow = '',
		title,
		description = '',
		actions
	}: { eyebrow?: string; title: string; description?: string; actions?: Snippet } = $props();
</script>

<header class="rise mb-8 flex flex-wrap items-end justify-between gap-4">
	<div class="min-w-0">
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<h1 class="mt-1.5 text-[28px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
		{#if description}<p class="text-muted-foreground mt-1.5 max-w-xl text-sm">{description}</p>{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
