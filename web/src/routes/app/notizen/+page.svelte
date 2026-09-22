<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { hausi } from '$lib/store.svelte';
	import type { Note } from '$lib/types';

	let selected = $state<string | null>(null);
	let title = $state('');
	let body = $state('');
	let subject = $state('');

	const current = $derived(hausi.notes.find((note) => note.$id === selected) ?? null);

	$effect(() => {
		if (!current) return;
		title = current.title;
		body = current.body;
		subject = current.subject;
	});

	function openNew() {
		if (window.hausiDesktop) window.hausiDesktop.openCapture();
		else hausi.captureOpen = true;
	}

	async function save(note: Note) {
		if (note.pending) return;
		await hausi.updateNote(note.$id, { title, body, subject });
		hausi.ping('Notiz gespeichert.');
	}
</script>

<div class="grid gap-4 pb-24 md:grid-cols-[240px_1fr] md:pb-8">
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h1 class="font-serif text-3xl">Notizen</h1>
			<Button size="icon" variant="outline" onclick={openNew} disabled={!hausi.hasSchedule}><Plus class="size-4" /></Button>
		</div>
		{#if !hausi.hasSchedule}
			<p class="text-muted-foreground text-sm">Notizen gibt es, sobald ein Stundenplan steht.</p>
		{/if}
		<div class="space-y-1">
			{#each hausi.notes as note}
				<button
					type="button"
					class="w-full rounded-2xl px-3 py-2 text-left text-sm {selected === note.$id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
					onclick={() => (selected = note.$id)}
				>
					<span class="block truncate font-medium">{note.title}</span>
					<span class="block truncate text-xs opacity-70">{note.subject || 'Ohne Fach'}</span>
				</button>
			{:else}
				<p class="text-muted-foreground text-sm">Noch keine Notiz.</p>
			{/each}
		</div>
	</div>
	{#if current}
		<div class="bg-card space-y-3 rounded-3xl border p-4">
			<Input bind:value={title} class="font-serif text-xl" />
			<Input bind:value={subject} placeholder="Fach, optional" />
			<Textarea bind:value={body} rows={12} />
			<div class="flex gap-2">
				<Button onclick={() => save(current)} disabled={current.pending}>Speichern</Button>
				<Button variant="ghost" onclick={() => hausi.deleteNote(current)}>Löschen</Button>
			</div>
		</div>
	{:else}
		<p class="text-muted-foreground self-center text-sm">Wähle eine Notiz oder leg eine neue an.</p>
	{/if}
</div>
