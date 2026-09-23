<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import X from '@lucide/svelte/icons/x';
	import { currentLesson, formatMin, formatWhen, jsWeekday, nextLesson, remindNextWeek, WEEKDAYS } from '$lib/schedule';
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

	const remindOptions: { id: RemindMode; label: string; hint: string }[] = [
		{ id: 'next_lesson', label: 'Nächste Stunde', hint: 'Vor der nächsten Stunde im Fach' },
		{ id: 'next_week', label: 'Nächste Woche', hint: 'Gleiche Zeit in 7 Tagen' },
		{ id: 'custom', label: 'Datum wählen', hint: 'Eigener Zeitpunkt' }
	];

	const weekday = jsWeekday();
	const now = $derived(currentLesson(hausi.activeLessons, new Date(tick)));
	const todayLessons = $derived(
		hausi.activeLessons.filter((lesson) => lesson.weekday === weekday).sort((a, b) => a.startMin - b.startMin)
	);
	const todaySubjects = $derived([...new Set(todayLessons.map((lesson) => lesson.subject))]);
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
	const stepIndex = $derived(
		step === 'title' ? 0 : step === 'details' ? 1 : step === 'remind' || step === 'custom' ? 3 : 2
	);
	const stepTotal = $derived(kind === 'task' ? 4 : 3);
	const tabHint = $derived(
		step === 'title'
			? kind === 'task'
				? 'Notiz'
				: 'Aufgabe'
			: step === 'attach'
				? 'wechseln'
				: step === 'pick' || step === 'other' || step === 'remind'
					? 'weiter'
					: ''
	);

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

	function back() {
		if (step === 'custom') step = 'remind';
		else if (step === 'remind') step = attach ? (pickIndex >= todaySubjects.length ? 'other' : 'pick') : 'attach';
		else if (step === 'other') step = todaySubjects.length ? 'pick' : 'attach';
		else if (step === 'pick') step = 'attach';
		else if (step === 'attach') step = 'details';
		else if (step === 'details') step = 'title';
		else onDone?.();
	}

	function cycle(delta: number) {
		if (step === 'attach') attach = !attach;
		else if (step === 'pick') pickIndex = (pickIndex + delta + pickCount) % pickCount;
		else if (step === 'other' && allSubjects.length)
			otherIndex = (otherIndex + delta + allSubjects.length) % allSubjects.length;
		else if (step === 'remind') remindIndex = (remindIndex + delta + remindOptions.length) % remindOptions.length;
	}

	function onKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
			event.preventDefault();
			fileInput?.click();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			back();
			return;
		}
		if (step === 'title' && event.key === 'Tab') {
			event.preventDefault();
			kind = kind === 'task' ? 'note' : 'task';
			return;
		}
		const listStep = step === 'attach' || step === 'pick' || step === 'other' || step === 'remind';
		if (listStep && event.key === 'Tab') {
			event.preventDefault();
			cycle(event.shiftKey ? -1 : 1);
			return;
		}
		if (listStep && (event.key === 'ArrowDown' || event.key === 'ArrowRight')) {
			event.preventDefault();
			cycle(1);
			return;
		}
		if (listStep && (event.key === 'ArrowUp' || event.key === 'ArrowLeft')) {
			event.preventDefault();
			cycle(-1);
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

	function lessonTime(subject: string) {
		const lesson = todayLessons.find((item) => item.subject === subject);
		return lesson ? formatMin(lesson.startMin) : '';
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet option(label: string, hint: string, selected: boolean, onclick: () => void, trailing = '')}
	<button
		type="button"
		class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left {selected
			? 'bg-primary text-primary-foreground'
			: 'hover:bg-accent'}"
		{onclick}
	>
		<span class="min-w-0 flex-1">
			<span class="block truncate text-sm font-medium">{label}</span>
			{#if hint}<span class="block truncate text-xs {selected ? 'opacity-60' : 'text-muted-foreground'}">{hint}</span>{/if}
		</span>
		{#if trailing}<span class="tabular shrink-0 text-xs {selected ? 'opacity-70' : 'text-muted-foreground'}">{trailing}</span>{/if}
		{#if selected}<Check class="size-4 shrink-0" />{/if}
	</button>
{/snippet}

<section
	bind:this={card}
	tabindex="-1"
	class="no-drag bg-popover text-popover-foreground shadow-float w-full max-w-lg overflow-hidden rounded-2xl border outline-none {desktop
		? ''
		: 'animate-in zoom-in-95 fade-in duration-150'}"
>
	<div class="drag flex items-center justify-between gap-3 border-b px-3 py-2.5">
		<div class="no-drag seg">
			<button type="button" aria-pressed={kind === 'task'} onclick={() => (kind = 'task')}>Aufgabe</button>
			<button type="button" aria-pressed={kind === 'note'} onclick={() => (kind = 'note')}>Notiz</button>
		</div>
		<div class="flex items-center gap-3">
			<div class="flex items-center gap-1" aria-label="Schritt {stepIndex + 1} von {stepTotal}">
				{#each Array(stepTotal) as _, index}
					<span
						class="h-1.5 rounded-full transition-all duration-200 {index === stepIndex
							? 'bg-foreground w-4'
							: index < stepIndex
								? 'bg-foreground/50 w-1.5'
								: 'bg-border w-1.5'}"
					></span>
				{/each}
			</div>
			<button type="button" class="no-drag btn btn-ghost btn-icon size-8" onclick={() => onDone?.()} aria-label="Schließen">
				<X class="size-4" />
			</button>
		</div>
	</div>

	<div class="space-y-3 px-4 pt-4 pb-3">
		{#if step !== 'title'}
			<p class="text-muted-foreground truncate px-1 text-xs">
				<span class="text-foreground font-medium">{title}</span>
				{#if chosenSubject && (step === 'remind' || step === 'custom')} · {chosenSubject}{/if}
			</p>
		{/if}

		{#if step === 'title'}
			<input
				bind:this={field}
				bind:value={title}
				placeholder={kind === 'task' ? 'Was ist zu tun?' : 'Worum geht es?'}
				class="placeholder:text-muted-foreground/70 w-full bg-transparent px-1 py-1 text-2xl font-semibold tracking-[-0.02em] outline-none"
			/>
		{:else if step === 'details'}
			<textarea
				bind:this={field}
				bind:value={details}
				rows="4"
				placeholder="Details, Seiten, Nummern … (optional)"
				class="placeholder:text-muted-foreground w-full resize-none bg-transparent px-1 text-[15px] leading-7 outline-none"
			></textarea>
		{:else if step === 'attach'}
			<div class="space-y-1">
				{@render option(
					'An Fach anheften',
					now ? `Gerade: ${now.subject}` : todaySubjects.length ? `${todaySubjects.length} Fächer heute` : 'Aus allen Fächern wählen',
					attach,
					() => {
						attach = true;
						advance();
					}
				)}
				{@render option('Nicht anheften', 'Ohne Fach speichern', !attach, () => {
					attach = false;
					advance();
				})}
			</div>
		{:else if step === 'pick'}
			<p class="eyebrow px-1">Heute · {WEEKDAYS[weekday]}</p>
			<div class="max-h-64 space-y-1 overflow-y-auto">
				{#each todaySubjects as subject, index}
					{@render option(
						subject,
						now?.subject === subject ? 'Läuft gerade' : '',
						pickIndex === index,
						() => {
							pickIndex = index;
							attach = true;
							goAfterSubject();
						},
						now?.subject === subject ? 'jetzt' : lessonTime(subject)
					)}
				{/each}
				<button
					type="button"
					class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left {pickIndex === todaySubjects.length
						? 'bg-primary text-primary-foreground'
						: 'hover:bg-accent text-muted-foreground'}"
					onclick={() => {
						pickIndex = todaySubjects.length;
						otherIndex = 0;
						step = 'other';
					}}
				>
					<span class="flex-1 text-sm font-medium">Anderes Fach …</span>
					<ArrowRight class="size-4" />
				</button>
			</div>
		{:else if step === 'other'}
			<p class="eyebrow px-1">Alle Fächer</p>
			<div class="max-h-64 space-y-1 overflow-y-auto">
				{#each allSubjects as subject, index}
					{@render option(subject, '', otherIndex === index, () => {
						otherIndex = index;
						attach = true;
						goAfterSubject();
					})}
				{/each}
			</div>
		{:else if step === 'remind'}
			<p class="eyebrow px-1">Erinnern</p>
			<div class="space-y-1">
				{#each remindOptions as item, index}
					{@render option(item.label, item.hint, index === remindIndex, () => {
						remindIndex = index;
						if (item.id === 'custom') step = 'custom';
						else void finish();
					})}
				{/each}
			</div>
			<p class="text-muted-foreground px-1 text-xs">
				{#if previewAt}Erinnerung: <span class="text-foreground tabular font-medium">{formatWhen(previewAt.toISOString())}</span>{:else}Ohne Erinnerung{/if}
			</p>
		{:else}
			<p class="eyebrow px-1">Datum und Uhrzeit</p>
			<input bind:this={field} bind:value={custom} type="datetime-local" class="field h-11" />
		{/if}

		{#if kind === 'task' && files.length}
			<p class="text-muted-foreground flex items-center gap-1.5 truncate px-1 text-xs">
				<Paperclip class="size-3.5 shrink-0" />{files.map((file) => file.name).join(', ')}
			</p>
		{/if}
	</div>

	<footer class="bg-muted/50 text-muted-foreground flex items-center justify-between gap-3 border-t px-4 py-2 text-[11px]">
		{#if kind === 'task'}
			<button type="button" class="no-drag hover:text-foreground inline-flex items-center gap-1.5" onclick={() => fileInput?.click()}>
				<Paperclip class="size-3.5" /> Datei <span class="kbd">Strg O</span>
			</button>
			<input bind:this={fileInput} class="hidden" type="file" multiple onchange={(event) => addFiles(event.currentTarget.files)} />
		{:else}
			<span></span>
		{/if}
		<p class="flex items-center gap-2.5">
			{#if saving}
				Speichert …
			{:else}
				{#if tabHint}<span class="flex items-center gap-1"><span class="kbd">Tab</span> {tabHint}</span>{/if}
				<span class="flex items-center gap-1"><span class="kbd">Enter</span> weiter</span>
				<span class="flex items-center gap-1"><span class="kbd">Esc</span> {step === 'title' ? 'schließen' : 'zurück'}</span>
			{/if}
		</p>
	</footer>
</section>
