<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Copy from '@lucide/svelte/icons/copy';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Switch } from '$lib/components/ui/switch';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { hausi } from '$lib/store.svelte';

	let selected = $state<string | null>(null);
	let loaded = $state('');
	let title = $state('');
	let body = $state('');
	let query = $state('');
	let saved = $state<'idle' | 'saving' | 'saved'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	const current = $derived(hausi.bookNotes.find((note) => note.$id === selected) ?? null);
	const share = $derived(current ? hausi.shareOf(current.$id, 'note') : null);
	let sharing = $state(false);
	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return hausi.bookNotes;
		return hausi.bookNotes.filter(
			(note) =>
				note.title.toLowerCase().includes(needle) ||
				note.body.toLowerCase().includes(needle) ||
				note.subject.toLowerCase().includes(needle)
		);
	});
	const subjectOptions = $derived(
		current?.subject && !hausi.subjects.includes(current.subject) ? [current.subject, ...hausi.subjects] : hausi.subjects
	);

	$effect(() => {
		if (!current || loaded === current.$id) return;
		title = current.title;
		body = current.body;
		loaded = current.$id;
		saved = 'idle';
	});

	function queueSave() {
		if (!current) return;
		const id = current.$id;
		saved = 'saving';
		clearTimeout(timer);
		timer = setTimeout(async () => {
			await hausi.updateNote(id, { title: title.trim() || 'Ohne Titel', body });
			saved = 'saved';
		}, 450);
	}

	async function createNote() {
		const pending = hausi.createNote({ title: 'Neue Notiz', body: '', subject: '' });
		selected = hausi.bookNotes[0]?.$id ?? null;
		await pending;
	}

	function shortDate(iso: string) {
		return iso ? new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(new Date(iso)) : '';
	}
</script>

<PageHeader eyebrow="Sammlung" title="Notizen" description="Mitschriften, Ideen und alles, was keine Aufgabe ist.">
	{#snippet actions()}
		<button type="button" class="btn btn-primary" onclick={createNote}><Plus class="size-4" /> Neue Notiz</button>
	{/snippet}
</PageHeader>

<div class="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
	<section class="card rise h-fit p-2 {current ? 'hidden md:block' : ''}">
		<label class="relative block p-1">
			<Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
			<input bind:value={query} class="field h-9 pl-9" placeholder="Notizen durchsuchen" />
		</label>
		<div class="mt-1 max-h-[60vh] space-y-0.5 overflow-y-auto">
			{#each filtered as note (note.$id)}
				<button
					type="button"
					class="w-full rounded-xl px-3 py-2.5 text-left {selected === note.$id ? 'bg-accent' : 'hover:bg-accent/60'}"
					onclick={() => (selected = note.$id)}
				>
					<span class="flex items-center justify-between gap-2">
						<span class="truncate text-sm font-medium">{note.title || 'Ohne Titel'}</span>
						<span class="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">
							{#if note.pending}<CloudOff class="size-3" />{/if}
							{shortDate(note.$createdAt)}
						</span>
					</span>
					<span class="text-muted-foreground mt-0.5 line-clamp-2 block text-xs leading-5">
						{#if note.subject}<span class="text-foreground/70 font-medium">{note.subject}</span> · {/if}{note.body || 'Leer'}
					</span>
				</button>
			{:else}
				<p class="text-muted-foreground px-3 py-6 text-center text-sm">{query ? 'Nichts gefunden.' : 'Noch keine Notizen.'}</p>
			{/each}
		</div>
	</section>

	{#if current}
		<section class="card rise flex min-h-[60vh] flex-col p-6">
			<div class="mb-4 flex flex-wrap items-center gap-2">
				<button type="button" class="btn btn-ghost btn-sm -ml-2 md:hidden" onclick={() => (selected = null)}>
					<ArrowLeft class="size-4" /> Zurück
				</button>
				<select
					class="field h-8 w-auto pr-8 text-xs"
					value={current.subject}
					onchange={(event) => hausi.updateNote(current.$id, { subject: event.currentTarget.value })}
				>
					<option value="">Ohne Fach</option>
					{#each subjectOptions as subject}
						<option value={subject}>{subject}</option>
					{/each}
				</select>
				<span class="text-muted-foreground ml-auto text-xs">
					{saved === 'saving' ? 'Speichert…' : saved === 'saved' ? 'Gespeichert' : ''}
				</span>
				<Switch
					checked={!!share}
					disabled={sharing || current.pending || !hausi.online}
					onCheckedChange={async (value) => {
						if (sharing) return;
						sharing = true;
						try {
							if (value) {
								const url = await hausi.shareNote({ ...current, title, body });
								if (url) {
									await navigator.clipboard.writeText(url);
									hausi.ping('Link kopiert.');
								}
							} else {
								await hausi.revokeShare(current.$id, 'note');
							}
						} catch {
							hausi.ping('Teilen hat nicht geklappt.', 'warn');
						} finally {
							sharing = false;
						}
					}}
				/>
				<button
					type="button"
					class="btn btn-ghost btn-icon size-8"
					title="Link kopieren"
					disabled={!share}
					onclick={async () => {
						if (!share) return;
						await navigator.clipboard.writeText(hausi.shareLink(share.$id));
						hausi.ping('Link kopiert.');
					}}
				>
					<Copy class="size-4" />
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-icon size-8"
					title="Löschen"
					onclick={async () => {
						const note = current;
						selected = null;
						await hausi.deleteNote(note);
					}}
				>
					<Trash2 class="size-4" />
				</button>
			</div>
			<input
				bind:value={title}
				oninput={queueSave}
				placeholder="Titel"
				class="w-full bg-transparent text-2xl font-semibold tracking-[-0.02em] outline-none"
			/>
			<textarea
				bind:value={body}
				oninput={queueSave}
				placeholder="Schreib los …"
				class="placeholder:text-muted-foreground mt-4 w-full flex-1 resize-none bg-transparent text-[15px] leading-7 outline-none"
			></textarea>
		</section>
	{:else}
		<section class="card rise hidden min-h-[60vh] flex-col items-center justify-center p-6 text-center md:flex">
			<span class="bg-secondary grid size-12 place-items-center rounded-2xl"><NotebookPen class="size-5" /></span>
			<p class="mt-4 text-sm font-medium">Wähle eine Notiz</p>
			<p class="text-muted-foreground mt-1 text-sm">oder leg mit „Neue Notiz“ eine an.</p>
		</section>
	{/if}
</div>
