<script lang="ts">
	import { hausi } from '$lib/store.svelte';
	import type { Note } from '$lib/types';

	let selected = $state<string | null>(null);
	let title = $state('');
	let body = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	const current = $derived(hausi.notes.find((note) => note.$id === selected) ?? null);

	$effect(() => {
		if (!current) return;
		title = current.title;
		body = current.body;
	});

	function queueSave(note: Note) {
		clearTimeout(timer);
		timer = setTimeout(async () => {
			if (note.pending) return;
			await hausi.updateNote(note.$id, { title, body, subject: note.subject });
		}, 400);
	}
</script>

<div class="grid gap-6 sm:grid-cols-[11rem_1fr]">
	<div>
		<h1 class="text-xl font-semibold tracking-tight">Notizen</h1>
		<div class="mt-3 space-y-0.5">
			{#each hausi.notes as note}
				<button
					type="button"
					class="w-full truncate rounded-md px-2 py-1.5 text-left text-sm {selected === note.$id
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (selected = note.$id)}
				>
					{note.title}
				</button>
			{:else}
				<p class="text-muted-foreground text-sm">Keine.</p>
			{/each}
		</div>
	</div>
	{#if current}
		<div>
			<input
				bind:value={title}
				oninput={() => queueSave(current)}
				class="w-full bg-transparent text-lg font-semibold outline-none"
			/>
			<textarea
				bind:value={body}
				oninput={() => queueSave(current)}
				rows={14}
				class="mt-3 w-full resize-none bg-transparent text-sm leading-6 outline-none"
			></textarea>
			<button type="button" class="text-muted-foreground mt-2 text-xs" onclick={() => hausi.deleteNote(current)}>Löschen</button>
		</div>
	{:else}
		<p class="text-muted-foreground self-start pt-8 text-sm">Eine Notiz wählen oder + drücken.</p>
	{/if}
</div>
