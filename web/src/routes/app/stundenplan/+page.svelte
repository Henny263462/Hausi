<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { currentLesson, formatMin, jsWeekday, parseTime, spanPeriods, subjectColor, WEEKDAYS } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';
	import type { Lesson, Period } from '$lib/types';

	const DEFAULT_PERIODS: Period[] = [
		{ label: '1', startMin: 7 * 60 + 50, endMin: 8 * 60 + 35 },
		{ label: '2', startMin: 8 * 60 + 35, endMin: 9 * 60 + 20 },
		{ label: '3', startMin: 9 * 60 + 40, endMin: 10 * 60 + 25 },
		{ label: '4', startMin: 10 * 60 + 30, endMin: 11 * 60 + 15 },
		{ label: '5', startMin: 11 * 60 + 30, endMin: 12 * 60 + 15 },
		{ label: '6', startMin: 12 * 60 + 20, endMin: 13 * 60 + 5 },
		{ label: '7', startMin: 14 * 60 + 5, endMin: 14 * 60 + 50 },
		{ label: '8', startMin: 14 * 60 + 50, endMin: 15 * 60 + 35 }
	];

	let planName = $state('');
	let draft = $state<Period[]>([]);
	let loaded = $state('');
	let editTimes = $state(false);
	let composer = $state<{ weekday: number; periodIndex: number } | null>(null);
	let subject = $state('');
	let room = $state('');
	let length = $state<'single' | 'double'>('single');
	let subjectInput = $state<HTMLInputElement | null>(null);

	const active = $derived(hausi.activeTimetable);
	const periods = $derived(active?.periods ?? []);
	const lessons = $derived(hausi.lessons.filter((lesson) => lesson.timetableId === active?.$id));
	const dayCount = $derived(Math.max(5, ...lessons.map((lesson) => lesson.weekday + 1)));
	const days = $derived(WEEKDAYS.slice(0, dayCount));
	const today = jsWeekday();
	const live = $derived(currentLesson(lessons));

	const placed = $derived.by(() => {
		const inGrid: { lesson: Lesson; row: number; span: number }[] = [];
		const loose: Lesson[] = [];
		for (const lesson of lessons) {
			const slot = slotFor(lesson);
			if (slot) inGrid.push({ lesson, ...slot });
			else loose.push(lesson);
		}
		return { inGrid, loose };
	});

	const taken = $derived.by(() => {
		const set = new Set<string>();
		for (const item of placed.inGrid) {
			for (let i = 0; i < item.span; i++) set.add(`${item.lesson.weekday}-${item.row + i}`);
		}
		return set;
	});

	$effect(() => {
		if (!active || loaded === active.$id) return;
		draft = (active.periods.length ? active.periods : DEFAULT_PERIODS).map((period) => ({ ...period }));
		editTimes = !active.periods.length;
		loaded = active.$id;
	});

	$effect(() => {
		if (composer) queueMicrotask(() => subjectInput?.focus());
	});

	function slotFor(lesson: Lesson) {
		if (!periods.length) return null;
		let start = periods.findIndex((period) => period.startMin === lesson.startMin);
		if (start < 0) start = periods.findLastIndex((period) => period.startMin <= lesson.startMin);
		if (start < 0) return null;
		let end = periods.findIndex((period) => period.endMin === lesson.endMin);
		if (end < 0) end = periods.findIndex((period) => period.endMin >= lesson.endMin);
		if (end < start) end = start;
		return { row: start, span: end - start + 1 };
	}

	async function createPlan(event?: SubmitEvent) {
		event?.preventDefault();
		if (!planName.trim()) return;
		await hausi.createTimetable(planName.trim());
		planName = '';
	}

	function addPeriod() {
		const last = draft[draft.length - 1];
		const startMin = last ? last.endMin + 5 : DEFAULT_PERIODS[0].startMin;
		draft = [...draft, { label: String(draft.length + 1), startMin, endMin: startMin + 45 }];
	}

	async function saveTimes() {
		if (!active) return;
		const clean = draft
			.filter((period) => period.endMin > period.startMin)
			.sort((a, b) => a.startMin - b.startMin)
			.map((period, index) => ({ ...period, label: String(index + 1) }));
		draft = clean;
		await hausi.savePeriods(active.$id, clean);
		editTimes = false;
		hausi.ping('Stundenzeiten gespeichert.');
	}

	function openComposer(weekday = today < 5 ? today : 0, periodIndex = 0) {
		subject = '';
		room = '';
		length = 'single';
		composer = { weekday, periodIndex };
	}

	async function addLesson(event: SubmitEvent) {
		event.preventDefault();
		if (!active || !composer || !subject.trim()) return;
		const span = spanPeriods(periods, Number(composer.periodIndex), length === 'double');
		if (!span) {
			hausi.ping('Für eine Doppelstunde fehlt die nächste Stunde.', 'warn');
			return;
		}
		const name = subject.trim();
		await hausi.addLesson({
			timetableId: active.$id,
			subject: name,
			weekday: Number(composer.weekday),
			startMin: span.startMin,
			endMin: span.endMin,
			room: room.trim(),
			color: subjectColor(name)
		});
		composer = null;
	}
</script>

<PageHeader eyebrow="Woche" title="Stundenplan" description="Einmal die Stundenzeiten festlegen, dann Fächer als Einzel- oder Doppelstunde eintragen.">
	{#snippet actions()}
		{#if active && periods.length}
			<button type="button" class="btn btn-outline" onclick={() => (editTimes = !editTimes)}>
				<Clock class="size-4" /> Zeiten
			</button>
			<button type="button" class="btn btn-primary" onclick={() => openComposer()}>
				<Plus class="size-4" /> Stunde eintragen
			</button>
		{/if}
	{/snippet}
</PageHeader>

{#if !hausi.timetables.length}
	<form class="card rise mx-auto max-w-md p-6 text-center" onsubmit={createPlan}>
		<h2 class="text-lg font-semibold tracking-tight">Neuen Stundenplan anlegen</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">Gib ihm einen Namen, zum Beispiel „Normalwoche“ oder „A-Woche“.</p>
		<div class="mt-5 flex gap-2">
			<input bind:value={planName} class="field" placeholder="Name des Plans" />
			<button type="submit" class="btn btn-primary">Anlegen</button>
		</div>
	</form>
{:else}
	<div class="rise mb-5 flex flex-wrap items-center gap-2">
		<div class="seg max-w-full overflow-x-auto">
			{#each hausi.timetables as plan (plan.$id)}
				<button type="button" aria-pressed={plan.$id === active?.$id} onclick={() => hausi.activateTimetable(plan.$id)}>
					{plan.name}
				</button>
			{/each}
		</div>
		<form class="flex items-center gap-1" onsubmit={createPlan}>
			<input bind:value={planName} class="field h-8 w-36 text-[13px]" placeholder="Weiterer Plan" />
			<button type="submit" class="btn btn-ghost btn-icon size-8" title="Plan anlegen" disabled={!planName.trim()}>
				<Plus class="size-4" />
			</button>
		</form>
	</div>

	{#if active && editTimes}
		<section class="card rise mb-6 p-5">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="eyebrow">{periods.length ? 'Stundenzeiten' : 'Schritt 1'}</p>
					<h3 class="mt-1 text-base font-semibold">Wann beginnt und endet jede Stunde?</h3>
					<p class="text-muted-foreground mt-1 text-sm">Das machst du nur einmal. Danach reicht ein Klick in den Plan.</p>
				</div>
				{#if periods.length}
					<button type="button" class="btn btn-ghost btn-icon size-8" onclick={() => (editTimes = false)} title="Schließen">
						<X class="size-4" />
					</button>
				{/if}
			</div>
			<div class="mt-5 grid gap-2 sm:grid-cols-2">
				{#each draft as period, index}
					<div class="bg-muted/60 flex items-center gap-2 rounded-xl px-3 py-2">
						<span class="tabular w-7 text-sm font-semibold">{index + 1}.</span>
						<input
							type="time"
							class="field tabular h-8 w-auto flex-1 px-2"
							value={formatMin(period.startMin)}
							onchange={(event) => {
								draft[index].startMin = parseTime(event.currentTarget.value);
								draft = [...draft];
							}}
						/>
						<span class="text-muted-foreground">–</span>
						<input
							type="time"
							class="field tabular h-8 w-auto flex-1 px-2"
							value={formatMin(period.endMin)}
							onchange={(event) => {
								draft[index].endMin = parseTime(event.currentTarget.value);
								draft = [...draft];
							}}
						/>
						<button
							type="button"
							class="btn btn-ghost btn-icon size-8"
							title="Entfernen"
							onclick={() => (draft = draft.filter((_, i) => i !== index))}
						>
							<X class="size-3.5" />
						</button>
					</div>
				{/each}
			</div>
			<div class="mt-4 flex flex-wrap gap-2">
				<button type="button" class="btn btn-outline btn-sm" onclick={addPeriod}><Plus class="size-3.5" /> Stunde</button>
				<button type="button" class="btn btn-primary btn-sm" onclick={() => void saveTimes()}>Zeiten speichern</button>
			</div>
		</section>
	{/if}

	{#if active && periods.length}
		<section class="card rise overflow-x-auto p-3 sm:p-4">
			<div
				class="grid min-w-[620px] gap-1.5"
				style:grid-template-columns="64px repeat({days.length}, minmax(0, 1fr))"
				style:grid-template-rows="auto repeat({periods.length}, minmax(64px, auto))"
			>
				<div></div>
				{#each days as day, index}
					<div class="px-1 pb-2 text-center">
						<span
							class="inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold {index === today
								? 'bg-foreground text-background'
								: 'text-muted-foreground'}"
						>
							{day.slice(0, 2)}
						</span>
					</div>
				{/each}

				{#each periods as period, row}
					<div class="flex flex-col justify-center pr-2 text-right" style:grid-row={row + 2} style:grid-column="1">
						<span class="text-sm font-semibold">{row + 1}.</span>
						<span class="tabular text-muted-foreground text-[10px] leading-tight">
							{formatMin(period.startMin)}<br />{formatMin(period.endMin)}
						</span>
					</div>
					{#each days as _, weekday}
						{#if !taken.has(`${weekday}-${row}`)}
							<button
								type="button"
								class="group border-border/70 hover:border-foreground/30 hover:bg-accent/60 grid place-items-center rounded-xl border border-dashed"
								style:grid-row={row + 2}
								style:grid-column={weekday + 2}
								title="{WEEKDAYS[weekday]}, {row + 1}. Stunde eintragen"
								onclick={() => openComposer(weekday, row)}
							>
								<Plus class="text-muted-foreground size-4 opacity-0 group-hover:opacity-100" />
							</button>
						{/if}
					{/each}
				{/each}

				{#each placed.inGrid as item (item.lesson.$id)}
					{@const isLive = live?.$id === item.lesson.$id}
					<div
						class="group relative flex flex-col justify-between rounded-xl p-2.5 {isLive
							? 'bg-primary text-primary-foreground shadow-float'
							: 'bg-accent'}"
						style:grid-row="{item.row + 2} / span {item.span}"
						style:grid-column={item.lesson.weekday + 2}
					>
						<div class="min-w-0">
							<p class="truncate text-[13px] leading-tight font-semibold">{item.lesson.subject}</p>
							{#if item.lesson.room}
								<p class="truncate text-[11px] opacity-60">{item.lesson.room}</p>
							{/if}
						</div>
						<p class="tabular mt-1 text-[10px] opacity-55">
							{formatMin(item.lesson.startMin)}–{formatMin(item.lesson.endMin)}{item.span > 1 ? ' · Doppel' : ''}
						</p>
						<button
							type="button"
							class="bg-card text-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md border opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
							title="Entfernen"
							onclick={() => hausi.deleteLesson(item.lesson.$id)}
						>
							<X class="size-3" />
						</button>
					</div>
				{/each}
			</div>
		</section>

		{#if placed.loose.length}
			<section class="card rise mt-4 p-5">
				<h3 class="text-sm font-semibold">Stunden außerhalb der Zeiten</h3>
				<ul class="mt-3 grid gap-2 sm:grid-cols-2">
					{#each placed.loose as lesson (lesson.$id)}
						<li class="bg-accent flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
							<span>
								<span class="font-medium">{lesson.subject}</span>
								<span class="text-muted-foreground tabular text-xs">
									{WEEKDAYS[lesson.weekday].slice(0, 2)} {formatMin(lesson.startMin)}–{formatMin(lesson.endMin)}
								</span>
							</span>
							<button type="button" class="btn btn-ghost btn-icon size-7" onclick={() => hausi.deleteLesson(lesson.$id)}>
								<X class="size-3.5" />
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}

	{#if active}
		<div class="mt-8 flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => {
					const name = prompt('Neuer Name für den Plan', active.name);
					if (name?.trim()) void hausi.renameTimetable(active.$id, name.trim());
				}}
			>
				<Pencil class="size-3.5" /> Umbenennen
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => {
					if (confirm(`„${active.name}“ mit allen Stunden löschen?`)) void hausi.deleteTimetable(active.$id);
				}}
			>
				<Trash2 class="size-3.5" /> Plan löschen
			</button>
		</div>
	{/if}
{/if}

{#if composer}
	<div
		class="animate-in fade-in fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 pt-[16vh] backdrop-blur-[2px] duration-150"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) composer = null;
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape') composer = null;
		}}
	>
		<form class="bg-popover shadow-float animate-in zoom-in-95 w-full max-w-sm rounded-2xl border p-5 duration-150" onsubmit={addLesson}>
			<div class="flex items-center justify-between">
				<h3 class="text-base font-semibold">Stunde eintragen</h3>
				<button type="button" class="btn btn-ghost btn-icon size-8" onclick={() => (composer = null)}><X class="size-4" /></button>
			</div>
			<div class="mt-4 space-y-3">
				<input
					bind:this={subjectInput}
					bind:value={subject}
					list="hausi-subjects"
					class="field h-11 text-base font-medium"
					placeholder="Fach, z. B. Mathe"
					required
				/>
				<datalist id="hausi-subjects">
					{#each hausi.subjects as name}<option value={name}></option>{/each}
				</datalist>
				<div class="grid grid-cols-2 gap-2">
					<select class="field" bind:value={composer.weekday}>
						{#each WEEKDAYS as day, index}
							<option value={index}>{day}</option>
						{/each}
					</select>
					<select class="field" bind:value={composer.periodIndex}>
						{#each periods as period, index}
							<option value={index}>{index + 1}. Stunde · {formatMin(period.startMin)}</option>
						{/each}
					</select>
				</div>
				<div class="seg grid w-full grid-cols-2">
					<button type="button" aria-pressed={length === 'single'} onclick={() => (length = 'single')}>Einzelstunde</button>
					<button
						type="button"
						aria-pressed={length === 'double'}
						disabled={Number(composer.periodIndex) >= periods.length - 1}
						class="disabled:opacity-40"
						onclick={() => (length = 'double')}
					>
						Doppelstunde
					</button>
				</div>
				<input bind:value={room} class="field" placeholder="Raum (optional)" />
			</div>
			<button type="submit" class="btn btn-primary mt-5 w-full" disabled={!subject.trim()}>Eintragen</button>
		</form>
	</div>
{/if}
