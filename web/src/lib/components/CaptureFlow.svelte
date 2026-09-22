<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import BookMarked from '@lucide/svelte/icons/book-marked';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Check from '@lucide/svelte/icons/check';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import X from '@lucide/svelte/icons/x';
	import { formatMin, formatWhen, nextLesson, remindNextWeek, WEEKDAYS } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';
	import type { RemindMode } from '$lib/types';

	let { desktop = false, onDone }: { desktop?: boolean; onDone?: () => void } = $props();

	let kind = $state<'task' | 'note'>('task');
	let step = $state<'title' | 'details' | 'subject' | 'remind' | 'custom'>('title');
	let title = $state('');
	let details = $state('');
	let attach = $state(true);
	let subjectIndex = $state(0);
	let remindIndex = $state(0);
	let custom = $state('');
	let files = $state<File[]>([]);
	let saving = $state(false);
	let field = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
	let card = $state<HTMLElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const remindOptions: { id: RemindMode; label: string; icon: typeof Bell }[] = [
		{ id: 'next_lesson', label: 'Nächste Stunde', icon: BookMarked },
		{ id: 'next_week', label: 'Nächste Woche', icon: CalendarClock },
		{ id: 'custom', label: 'Eigenes Datum', icon: Bell }
	];

	const subjects = $derived(hausi.subjects);
	const chosenSubject = $derived(!attach || subjects.length === 0 ? '' : (subjects[subjectIndex] ?? ''));
	const lessonMatch = $derived(
		chosenSubject ? hausi.activeLessons.find((lesson) => lesson.subject === chosenSubject) : undefined
	);
	const previewAt = $derived.by(() => {
		const mode = remindOptions[remindIndex]?.id;
		if (mode === 'next_lesson') return nextLesson(hausi.activeLessons, new Date(), chosenSubject || undefined)?.at ?? null;
		if (mode === 'next_week') return remindNextWeek(new Date(), lessonMatch);
		if (mode === 'custom' && custom) return new Date(custom);
		return null;
	});

	$effect(() => {
		if (subjectIndex >= subjects.length) subjectIndex = 0;
	});

	$effect(() => {
		step;
		queueMicrotask(() => {
			if (field) field.focus();
			else card?.focus();
		});
	});

	function advance() {
		if (step === 'title') {
			if (!title.trim()) return;
			step = 'details';
			return;
		}
		if (step === 'details') {
			step = 'subject';
			return;
		}
		if (step === 'subject') {
			if (kind === 'note') void finish();
			else step = 'remind';
			return;
		}
		if (step === 'remind') {
			if (remindOptions[remindIndex].id === 'custom') step = 'custom';
			else void finish();
			return;
		}
		if (!custom) return;
		void finish();
	}

	async function finish() {
		if (saving) return;
		saving = true;
		const mode = remindOptions[remindIndex].id;
		const at = kind === 'task' ? previewAt : null;
		if (kind === 'note') {
			await hausi.createNote({ title: title.trim(), body: details.trim(), subject: chosenSubject });
		} else {
			await hausi.createTask({
				title: title.trim(),
				details: details.trim(),
				subject: chosenSubject,
				lessonId: lessonMatch?.$id ?? '',
				remindMode: at ? mode : 'none',
				remindAt: at ? at.toISOString() : null,
				files
			});
		}
		saving = false;
		onDone?.();
	}

	function onKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
			event.preventDefault();
			fileInput?.click();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			if (step !== 'title') {
				if (step === 'custom') step = 'remind';
				else if (step === 'remind') step = 'subject';
				else if (step === 'subject') step = 'details';
				else step = 'title';
				return;
			}
			onDone?.();
			return;
		}
		if (step === 'title' && event.key === 'Tab') {
			event.preventDefault();
			kind = kind === 'task' ? 'note' : 'task';
			return;
		}
		if (step === 'subject' && event.key === 'Tab') {
			event.preventDefault();
			attach = !attach;
			return;
		}
		if (step === 'subject' && attach && (event.key === 'ArrowRight' || event.key === 'ArrowDown')) {
			event.preventDefault();
			if (subjects.length) subjectIndex = (subjectIndex + 1) % subjects.length;
			return;
		}
		if (step === 'subject' && attach && (event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
			event.preventDefault();
			if (subjects.length) subjectIndex = (subjectIndex - 1 + subjects.length) % subjects.length;
			return;
		}
		if (step === 'remind' && (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowDown')) {
			event.preventDefault();
			remindIndex = (remindIndex + 1) % remindOptions.length;
			return;
		}
		if (step === 'remind' && (event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
			event.preventDefault();
			remindIndex = (remindIndex - 1 + remindOptions.length) % remindOptions.length;
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			advance();
		}
	}

	function addFiles(list: FileList | null) {
		if (!list) return;
		files = [...files, ...Array.from(list)];
	}
</script>

<svelte:window onkeydown={onKeydown} />

<section
	bind:this={card}
	tabindex="-1"
	class="no-drag border-border bg-card text-card-foreground w-full max-w-xl rounded-3xl border shadow-2xl outline-none {desktop
		? ''
		: ''}"
>
	<div class="drag flex items-center justify-between px-5 pt-4">
		<p class="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
			{#if kind === 'task'}
				<SquarePen class="size-3.5" /> Aufgabe
			{:else}
				<NotebookPen class="size-3.5" /> Notiz
			{/if}
		</p>
		<button type="button" class="no-drag text-muted-foreground hover:text-foreground" onclick={() => onDone?.()}>
			<X class="size-4" />
		</button>
	</div>

	<div class="space-y-4 px-5 pt-3 pb-4">
		{#if step === 'title'}
			<input
				bind:this={field}
				bind:value={title}
				placeholder={kind === 'task' ? 'Was ist zu tun?' : 'Worum geht die Notiz?'}
				class="font-serif placeholder:text-muted-foreground/70 w-full bg-transparent text-3xl font-medium outline-none"
			/>
			<p class="text-muted-foreground text-sm">Tab wechselt zwischen Aufgabe und Notiz.</p>
		{:else if step === 'details'}
			<p class="font-serif text-xl">{title}</p>
			<textarea
				bind:this={field}
				bind:value={details}
				rows="4"
				placeholder={kind === 'task' ? 'Details, Seiten, was genau…' : 'Schreib los…'}
				class="placeholder:text-muted-foreground/70 w-full resize-none bg-transparent text-base outline-none"
			></textarea>
			<p class="text-muted-foreground text-sm">Enter weiter · Umschalt+Enter für eine neue Zeile.</p>
		{:else if step === 'subject'}
			<p class="text-muted-foreground text-sm">An ein Fach hängen?</p>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="rounded-2xl border px-3 py-3 text-left {attach
						? 'border-primary bg-primary/10'
						: 'border-border'}"
					onclick={() => (attach = true)}
				>
					<span class="block text-sm font-medium">An Fach</span>
					<span class="text-muted-foreground text-xs">Tab schaltet um</span>
				</button>
				<button
					type="button"
					class="rounded-2xl border px-3 py-3 text-left {!attach
						? 'border-primary bg-primary/10'
						: 'border-border'}"
					onclick={() => (attach = false)}
				>
					<span class="block text-sm font-medium">Ohne Fach</span>
					<span class="text-muted-foreground text-xs">Einfach so speichern</span>
				</button>
			</div>
			{#if attach}
				{#if subjects.length === 0}
					<p class="text-sm text-amber-800">Im Stundenplan gibt es noch keine Fächer.</p>
				{:else}
					<div class="flex flex-wrap gap-2">
						{#each subjects as subject, index}
							<button
								type="button"
								class="rounded-full border px-3 py-1 text-sm {index === subjectIndex
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-border'}"
								onclick={() => (subjectIndex = index)}
							>
								{subject}
							</button>
						{/each}
					</div>
					<p class="text-muted-foreground text-xs">Pfeiltasten wählen das Fach.</p>
				{/if}
			{/if}
		{:else if step === 'remind'}
			<p class="text-muted-foreground text-sm">Wann sollen wir erinnern?</p>
			<div class="grid gap-2">
				{#each remindOptions as option, index}
					{@const Icon = option.icon}
					<button
						type="button"
						class="flex items-center gap-3 rounded-2xl border px-3 py-3 text-left {index === remindIndex
							? 'border-primary bg-primary/10'
							: 'border-border'}"
						onclick={() => (remindIndex = index)}
					>
						<Icon class="size-4" />
						<span class="text-sm font-medium">{option.label}</span>
						{#if index === remindIndex}
							<Check class="ml-auto size-4" />
						{/if}
					</button>
				{/each}
			</div>
			<p class="text-muted-foreground text-sm">
				{#if previewAt}
					Erinnerung {formatWhen(previewAt.toISOString())}
					{#if lessonMatch}
						· {lessonMatch.subject}, {WEEKDAYS[lessonMatch.weekday]} {formatMin(lessonMatch.startMin)}
					{/if}
				{:else}
					Keine passende Stunde gefunden. Die Aufgabe wird ohne Erinnerung gespeichert.
				{/if}
			</p>
		{:else}
			<p class="text-muted-foreground text-sm">Eigenes Datum und Uhrzeit</p>
			<input bind:this={field} bind:value={custom} type="datetime-local" class="border-input bg-background w-full rounded-xl border px-3 py-2" />
		{/if}

		{#if kind === 'task' && files.length}
			<ul class="text-muted-foreground flex flex-wrap gap-2 text-xs">
				{#each files as file}
					<li class="bg-muted rounded-full px-2 py-1">{file.name}</li>
				{/each}
			</ul>
		{/if}
	</div>

	<footer class="text-muted-foreground flex items-center justify-between gap-3 border-t px-5 py-3 text-xs">
		<div class="flex items-center gap-2">
			{#if kind === 'task'}
				<button type="button" class="no-drag hover:text-foreground inline-flex items-center gap-1" onclick={() => fileInput?.click()}>
					<Paperclip class="size-3.5" /> Datei
				</button>
				<input bind:this={fileInput} class="hidden" type="file" multiple onchange={(event) => addFiles(event.currentTarget.files)} />
			{/if}
		</div>
		<p>{saving ? 'Speichert…' : 'Enter bestätigt · Esc zurück'}</p>
	</footer>
</section>
