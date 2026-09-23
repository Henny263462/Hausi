<script lang="ts">
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import X from '@lucide/svelte/icons/x';
	import { currentLesson, formatMin, formatWhen, jsWeekday, nextLesson, remindNextWeek } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';
	import type { RemindMode } from '$lib/types';

	let { desktop = false, onDone }: { desktop?: boolean; onDone?: () => void } = $props();

	let kind = $state<'task' | 'note'>('task');
	let step = $state<'title' | 'details' | 'attach' | 'pick' | 'other' | 'remind' | 'custom'>('title');
	let title = $state('');
	let details = $state('');
	let attach = $state(true);
	let pickIndex = $state(0);
	let otherIndex = $state(0);
	let remindIndex = $state(0);
	let custom = $state('');
	let files = $state<File[]>([]);
	let saving = $state(false);
	let tick = $state(Date.now());
	let field = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
	let card = $state<HTMLElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const remindOptions: { id: RemindMode; label: string }[] = [
		{ id: 'next_lesson', label: 'Nächste Stunde' },
		{ id: 'next_week', label: 'Nächste Woche' },
		{ id: 'custom', label: 'Datum' }
	];

	const now = $derived(currentLesson(hausi.activeLessons, new Date(tick)));
	const todaySubjects = $derived(
		[...new Set(hausi.activeLessons.filter((lesson) => lesson.weekday === jsWeekday()).map((lesson) => lesson.subject))]
	);
	const allSubjects = $derived(hausi.subjects);
	const pickCount = $derived(todaySubjects.length + 1);
	const chosenSubject = $derived.by(() => {
		if (!attach) return '';
		if (step === 'other') return allSubjects[otherIndex] ?? '';
		if (pickIndex < todaySubjects.length) return todaySubjects[pickIndex] ?? '';
		return allSubjects[otherIndex] ?? '';
	});
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
		const id = setInterval(() => (tick = Date.now()), 15_000);
		return () => clearInterval(id);
	});

	$effect(() => {
		step;
		queueMicrotask(() => {
			if (field) field.focus();
			else card?.focus();
		});
	});

	function seedPick() {
		const current = now?.subject;
		const index = current ? todaySubjects.indexOf(current) : 0;
		pickIndex = index >= 0 ? index : 0;
	}

	function goAfterSubject() {
		if (kind === 'note') void finish();
		else step = 'remind';
	}

	function advance() {
		if (step === 'title') {
			if (!title.trim()) return;
			step = 'details';
			return;
		}
		if (step === 'details') {
			step = 'attach';
			attach = true;
			return;
		}
		if (step === 'attach') {
			if (!attach) {
				goAfterSubject();
				return;
			}
			if (!todaySubjects.length) {
				if (!allSubjects.length) {
					attach = false;
					goAfterSubject();
					return;
				}
				otherIndex = 0;
				step = 'other';
				return;
			}
			seedPick();
			step = 'pick';
			return;
		}
		if (step === 'pick') {
			if (pickIndex >= todaySubjects.length) {
				otherIndex = 0;
				step = 'other';
				return;
			}
			attach = true;
			goAfterSubject();
			return;
		}
		if (step === 'other') {
			attach = true;
			goAfterSubject();
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
			if (step === 'custom') step = 'remind';
			else if (step === 'remind') step = attach ? (pickIndex >= todaySubjects.length ? 'other' : 'pick') : 'attach';
			else if (step === 'other') step = todaySubjects.length ? 'pick' : 'attach';
			else if (step === 'pick') step = 'attach';
			else if (step === 'attach') step = 'details';
			else if (step === 'details') step = 'title';
			else onDone?.();
			return;
		}
		if (step === 'title' && event.key === 'Tab') {
			event.preventDefault();
			kind = kind === 'task' ? 'note' : 'task';
			return;
		}
		if (step === 'attach' && event.key === 'Tab') {
			event.preventDefault();
			attach = !attach;
			return;
		}
		if (step === 'pick' && event.key === 'Tab') {
			event.preventDefault();
			pickIndex = (pickIndex + 1) % pickCount;
			return;
		}
		if (step === 'other' && event.key === 'Tab') {
			event.preventDefault();
			if (allSubjects.length) otherIndex = (otherIndex + 1) % allSubjects.length;
			return;
		}
		if (step === 'pick' && (event.key === 'ArrowDown' || event.key === 'ArrowRight')) {
			event.preventDefault();
			pickIndex = (pickIndex + 1) % pickCount;
			return;
		}
		if (step === 'pick' && (event.key === 'ArrowUp' || event.key === 'ArrowLeft')) {
			event.preventDefault();
			pickIndex = (pickIndex - 1 + pickCount) % pickCount;
			return;
		}
		if (step === 'other' && (event.key === 'ArrowDown' || event.key === 'ArrowRight')) {
			event.preventDefault();
			if (allSubjects.length) otherIndex = (otherIndex + 1) % allSubjects.length;
			return;
		}
		if (step === 'other' && (event.key === 'ArrowUp' || event.key === 'ArrowLeft')) {
			event.preventDefault();
			if (allSubjects.length) otherIndex = (otherIndex - 1 + allSubjects.length) % allSubjects.length;
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
	class="no-drag border-border bg-popover w-full max-w-md rounded-md border shadow-lg outline-none {desktop ? '' : ''}"
>
	<div class="drag flex items-center justify-between px-4 pt-3">
		<p class="text-muted-foreground flex items-center gap-1.5 text-xs">
			{#if kind === 'task'}
				<SquarePen class="size-3.5" /> Aufgabe
			{:else}
				<NotebookPen class="size-3.5" /> Notiz
			{/if}
			· Tab wechselt
		</p>
		<button type="button" class="no-drag text-muted-foreground" onclick={() => onDone?.()}>
			<X class="size-4" />
		</button>
	</div>

	<div class="space-y-3 px-4 pt-2 pb-3">
		{#if step === 'title'}
			<input
				bind:this={field}
				bind:value={title}
				placeholder={kind === 'task' ? 'Was ist zu tun?' : 'Notiz'}
				class="placeholder:text-muted-foreground w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
			/>
		{:else if step === 'details'}
			<p class="text-lg font-semibold tracking-tight">{title}</p>
			<textarea
				bind:this={field}
				bind:value={details}
				rows="3"
				placeholder="Details, optional"
				class="placeholder:text-muted-foreground w-full resize-none bg-transparent text-sm outline-none"
			></textarea>
		{:else if step === 'attach'}
			<p class="text-muted-foreground text-xs">Tab wechselt · Enter bestätigt</p>
			<button
				type="button"
				class="w-full rounded-md px-3 py-2 text-left text-sm {attach
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => {
					attach = true;
					advance();
				}}
			>
				An Fach anheften
			</button>
			<button
				type="button"
				class="w-full rounded-md px-3 py-2 text-left text-sm {!attach
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => {
					attach = false;
					advance();
				}}
			>
				Nicht anheften
			</button>
		{:else if step === 'pick'}
			<p class="text-muted-foreground text-xs">Heute · Tab weiter</p>
			<div class="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
				{#each todaySubjects as subject, index}
					<button
						type="button"
						class="rounded-md px-3 py-1.5 text-left text-sm {pickIndex === index
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => {
							pickIndex = index;
							attach = true;
							goAfterSubject();
						}}
					>
						{subject}
						{#if now?.subject === subject}
							<span class="opacity-70"> jetzt {formatMin(now.startMin)}</span>
						{/if}
					</button>
				{/each}
				<button
					type="button"
					class="rounded-md px-3 py-1.5 text-left text-sm {pickIndex === todaySubjects.length
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => {
						pickIndex = todaySubjects.length;
						otherIndex = 0;
						step = 'other';
					}}
				>
					Anderes Fach
				</button>
			</div>
		{:else if step === 'other'}
			<p class="text-muted-foreground text-xs">Alle Fächer · Tab weiter</p>
			<div class="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
				{#each allSubjects as subject, index}
					<button
						type="button"
						class="rounded-md px-3 py-1.5 text-left text-sm {otherIndex === index
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => {
							otherIndex = index;
							attach = true;
							goAfterSubject();
						}}
					>
						{subject}
					</button>
				{/each}
			</div>
		{:else if step === 'remind'}
			<div class="flex flex-col gap-1">
				{#each remindOptions as option, index}
					<button
						type="button"
						class="rounded-md px-2 py-1.5 text-left text-sm {index === remindIndex
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => {
							remindIndex = index;
							if (option.id === 'custom') step = 'custom';
							else void finish();
						}}
					>
						{option.label}
					</button>
				{/each}
			</div>
			<p class="text-muted-foreground text-xs">
				{#if previewAt}{formatWhen(previewAt.toISOString())}{:else}Ohne Erinnerung{/if}
			</p>
		{:else}
			<input bind:this={field} bind:value={custom} type="datetime-local" class="w-full bg-transparent text-sm outline-none" />
		{/if}

		{#if kind === 'task' && files.length}
			<p class="text-muted-foreground truncate text-xs">{files.map((file) => file.name).join(', ')}</p>
		{/if}
	</div>

	<footer class="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-[11px]">
		{#if kind === 'task'}
			<button type="button" class="no-drag inline-flex items-center gap-1" onclick={() => fileInput?.click()}>
				<Paperclip class="size-3.5" /> Datei
			</button>
			<input bind:this={fileInput} class="hidden" type="file" multiple onchange={(event) => addFiles(event.currentTarget.files)} />
		{:else}
			<span></span>
		{/if}
		<p>{saving ? '…' : 'Enter · Esc'}</p>
	</footer>
</section>
