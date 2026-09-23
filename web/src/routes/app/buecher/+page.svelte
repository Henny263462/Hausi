<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Copy from '@lucide/svelte/icons/copy';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Users from '@lucide/svelte/icons/users';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { hausi } from '$lib/store.svelte';

	let name = $state('');
	let busy = $state(false);

	async function createBook() {
		if (busy) return;
		busy = true;
		try {
			await hausi.createSharedBook(name);
			name = '';
		} catch {
			hausi.ping('Buch konnte nicht erstellt werden.', 'warn');
		} finally {
			busy = false;
		}
	}
</script>

<PageHeader
	eyebrow="Zusammen"
	title="Bücher"
	description="Dein privates Buch bleibt nur bei dir. Ein geteiltes Buch ist für die Klasse – Aufgaben, Notizen und Termine liegen dort für alle Mitglieder."
/>

<section class="card rise p-5">
	<h2 class="text-sm font-semibold">Neues geteiltes Buch</h2>
	<p class="text-muted-foreground mt-1 text-sm">Mitschüler treten über den Einladungslink bei.</p>
	<form class="mt-4 flex flex-wrap gap-2" onsubmit={(event) => { event.preventDefault(); void createBook(); }}>
		<input bind:value={name} class="field max-w-sm flex-1" placeholder="z. B. Klasse 10b" />
		<button type="submit" class="btn btn-primary" disabled={busy}><Plus class="size-4" /> Erstellen</button>
	</form>
</section>

<div class="mt-6 grid gap-3">
	{#each hausi.books as book (book.$id)}
		{@const active = hausi.activeBook?.$id === book.$id}
		<article class="card rise p-5">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<button type="button" class="min-w-0 text-left" onclick={() => hausi.setActiveBook(book.$id)}>
					<p class="flex items-center gap-2 text-sm font-semibold">
						{#if book.kind === 'private'}<BookOpen class="size-4" />{:else}<Users class="size-4" />{/if}
						{book.kind === 'private' ? 'Privates Buch' : book.name}
					</p>
					<p class="text-muted-foreground mt-1 text-xs">
						{book.kind === 'private' ? 'Nur du siehst diese Aufgaben und Notizen.' : 'Geteilt – alle im Buch können ablegen und bearbeiten.'}
						{#if active}<span class="text-foreground font-medium"> · Aktiv</span>{/if}
					</p>
				</button>
				<div class="flex flex-wrap gap-2">
					{#if !active}
						<button type="button" class="btn btn-outline btn-sm" onclick={() => hausi.setActiveBook(book.$id)}>Öffnen</button>
					{/if}
					{#if book.kind === 'shared' && book.inviteCode}
						<button
							type="button"
							class="btn btn-outline btn-sm"
							onclick={async () => {
								await navigator.clipboard.writeText(hausi.bookLink(book));
								hausi.ping('Einladungslink kopiert.');
							}}
						>
							<Copy class="size-3.5" /> Einladen
						</button>
					{/if}
					{#if book.kind === 'shared' && book.userId === hausi.user?.$id}
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => hausi.deleteBook(book)}>
							<Trash2 class="size-3.5" /> Löschen
						</button>
					{:else if book.kind === 'shared'}
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => hausi.leaveBook(book)}>Verlassen</button>
					{/if}
				</div>
			</div>
			{#if book.kind === 'shared' && book.userId === hausi.user?.$id}
				<input
					class="field mt-4 h-9"
					value={book.name}
					onchange={(event) => hausi.renameBook(book.$id, event.currentTarget.value.trim() || book.name)}
				/>
			{/if}
		</article>
	{/each}
</div>
