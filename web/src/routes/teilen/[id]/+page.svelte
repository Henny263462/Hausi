<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { hausi } from '$lib/store.svelte';
	import type { Share } from '$lib/types';

	let share = $state<Share | null>(null);
	let missing = $state(false);
	let taking = $state(false);

	onMount(async () => {
		const id = page.params.id;
		if (!id) {
			missing = true;
			return;
		}
		share = await hausi.loadShare(id);
		missing = !share;
	});

	async function take() {
		if (!share) return;
		if (!hausi.user) {
			goto('/anmelden');
			return;
		}
		if (!hausi.hasSchedule) {
			hausi.ping('Zuerst einen Stundenplan.', 'warn');
			goto('/app/stundenplan');
			return;
		}
		taking = true;
		try {
			await hausi.adoptShare(share);
			goto('/app/aufgaben');
		} finally {
			taking = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-5 py-12">
	<a href="/" class="mb-8 flex items-center gap-2.5">
		<span class="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl text-base font-bold">H</span>
		<span class="text-lg font-semibold tracking-tight">Hausi</span>
	</a>
	<div class="card rise w-full max-w-md p-6">
		{#if !share && !missing}
			<div class="space-y-3">
				<div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
				<div class="bg-muted h-7 w-3/4 animate-pulse rounded"></div>
				<div class="bg-muted h-16 animate-pulse rounded"></div>
			</div>
		{:else if missing || !share}
			<h1 class="text-lg font-semibold">Dieser Link ist nicht mehr gültig.</h1>
			<p class="text-muted-foreground mt-1 text-sm">Die Aufgabe wurde gelöscht oder nicht mehr geteilt.</p>
		{:else}
			<p class="eyebrow">Geteilte Aufgabe</p>
			<div class="mt-3 flex items-center gap-2">
				<span class="chip">{share.subject || 'Ohne Fach'}</span>
			</div>
			<h1 class="mt-3 text-2xl font-semibold tracking-[-0.02em]">{share.title}</h1>
			{#if share.details}
				<p class="text-muted-foreground mt-3 text-[15px] leading-7 whitespace-pre-wrap">{share.details}</p>
			{/if}
			{#if share.fileIds.length}
				<div class="mt-4 space-y-1.5">
					{#each share.fileIds as fileId, index}
						<a
							href={hausi.fileUrl(fileId)}
							target="_blank"
							rel="noreferrer"
							class="hover:bg-accent flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
						>
							<Download class="size-4" /> Anhang {index + 1}
						</a>
					{/each}
				</div>
			{/if}
			<div class="mt-6 flex gap-2">
				<button type="button" class="btn btn-primary flex-1" onclick={take} disabled={taking}>
					{taking ? 'Wird übernommen …' : 'In meine Aufgaben'}
				</button>
				<a class="btn btn-outline" href="/app">Hausi öffnen</a>
			</div>
		{/if}
	</div>
</div>
