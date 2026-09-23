<script lang="ts">
	import { hausi } from '$lib/store.svelte';

	let { compact = false }: { compact?: boolean } = $props();
	let tick = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => (tick = Date.now()), 30_000);
		return () => clearInterval(id);
	});

	const ago = $derived.by(() => {
		if (!hausi.syncedAt) return 'noch nie';
		const minutes = Math.round((tick - new Date(hausi.syncedAt).getTime()) / 60_000);
		if (minutes < 1) return 'gerade eben';
		if (minutes < 60) return `vor ${minutes} Min.`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `vor ${hours} Std.`;
		return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(new Date(hausi.syncedAt));
	});

	const status = $derived(!hausi.online ? 'offline' : hausi.syncing ? 'syncing' : hausi.queued ? 'queued' : 'ok');
	const label = $derived(
		status === 'offline'
			? 'Offline'
			: status === 'syncing'
				? 'Synchronisiere…'
				: status === 'queued'
					? `${hausi.queued} warten`
					: 'Synchronisiert'
	);
	const detail = $derived(
		status === 'offline'
			? hausi.queued
				? `${hausi.queued} Änderung${hausi.queued === 1 ? '' : 'en'} lokal`
				: 'Alles lokal gespeichert'
			: ago
	);
</script>

<button
	type="button"
	class="hover:bg-accent flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left {compact ? 'justify-center' : ''}"
	title="{label} · {detail}"
	onclick={() => hausi.syncNow()}
>
	<span class="relative flex size-2 shrink-0">
		{#if status === 'syncing'}
			<span class="bg-foreground absolute inline-flex size-full animate-ping rounded-full opacity-40"></span>
		{/if}
		<span
			class="relative inline-flex size-2 rounded-full {status === 'offline'
				? 'border-foreground border bg-transparent'
				: status === 'queued'
					? 'bg-muted-foreground'
					: 'bg-foreground'}"
		></span>
	</span>
	{#if !compact}
		<span class="min-w-0 leading-tight">
			<span class="block text-xs font-medium">{label}</span>
			<span class="text-muted-foreground block truncate text-[11px]">{detail}</span>
		</span>
	{/if}
</button>
