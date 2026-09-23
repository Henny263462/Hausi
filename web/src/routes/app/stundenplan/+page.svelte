<script lang="ts">
	import { formatMin, parseTime, spanPeriods, subjectColor, WEEKDAYS } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';
	import type { Period } from '$lib/types';

	let planName = $state('');
	let subject = $state('');
	let weekday = $state(0);
	let room = $state('');
	let periodIndex = $state(0);
	let length = $state<'single' | 'double'>('single');
	let draft = $state<Period[]>([]);
	let loaded = $state('');

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

	const active = $derived(hausi.activeTimetable);
	const days = WEEKDAYS.slice(0, 5);
	const periods = $derived(active?.periods ?? []);
	const lessons = $derived(
		hausi.lessons
			.filter((lesson) => lesson.timetableId === active?.$id)
			.slice()
			.sort((a, b) => a.startMin - b.startMin)
	);

	$effect(() => {
		if (!active || loaded === active.$id) return;
		draft = active.periods.length
			? active.periods.map((period) => ({ ...period }))
			: DEFAULT_PERIODS.map((period) => ({ ...period }));
		loaded = active.$id;
		periodIndex = 0;
	});

	async function createPlan() {
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
		const clean = draft.filter((period) => period.endMin > period.startMin);
		await hausi.savePeriods(active.$id, clean);
		hausi.ping('Stundenzeiten gespeichert.');
	}

	async function addLesson() {
		if (!active || !subject.trim()) return;
		if (!periods.length) {
			hausi.ping('Zuerst die Stundenzeiten festlegen.', 'warn');
			return;
		}
		const span = spanPeriods(periods, Number(periodIndex), length === 'double');
		if (!span) {
			hausi.ping('Für eine Doppelstunde fehlt die nächste Stunde.', 'warn');
			return;
		}
		await hausi.addLesson({
			timetableId: active.$id,
			subject: subject.trim(),
			weekday: Number(weekday),
			startMin: span.startMin,
			endMin: span.endMin,
			room: room.trim(),
			color: subjectColor(subject.trim())
		});
		subject = '';
		room = '';
	}
</script>

<div>
	<h1 class="text-xl font-semibold tracking-tight">Stundenplan</h1>

	<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
		{#each hausi.timetables as plan}
			<button
				type="button"
				class={plan.$id === active?.$id ? 'font-medium' : 'text-muted-foreground'}
				onclick={() => hausi.activateTimetable(plan.$id)}
			>
				{plan.name}
			</button>
		{/each}
		<form class="flex gap-1" onsubmit={(event) => { event.preventDefault(); void createPlan(); }}>
			<input bind:value={planName} placeholder="Neuer Plan" class="placeholder:text-muted-foreground w-32 bg-transparent text-sm outline-none" />
			<button type="submit" class="text-muted-foreground text-sm">+</button>
		</form>
	</div>

	{#if active}
		<section class="mt-6 border-b pb-4">
			<p class="text-sm font-medium">Stundenzeiten</p>
			<p class="text-muted-foreground mt-1 text-xs">Einmal festlegen. Danach nur noch Einzel- oder Doppelstunde wählen.</p>
			<div class="mt-3 space-y-2">
				{#each draft as period, index}
					<div class="flex flex-wrap items-center gap-2 text-sm">
						<span class="text-muted-foreground w-6">{period.label}</span>
						<input
							type="time"
							class="bg-transparent outline-none"
							value={formatMin(period.startMin)}
							onchange={(event) => {
								draft[index].startMin = parseTime(event.currentTarget.value);
								draft = [...draft];
							}}
						/>
						<span class="text-muted-foreground">–</span>
						<input
							type="time"
							class="bg-transparent outline-none"
							value={formatMin(period.endMin)}
							onchange={(event) => {
								draft[index].endMin = parseTime(event.currentTarget.value);
								draft = [...draft];
							}}
						/>
						<button type="button" class="text-muted-foreground" onclick={() => (draft = draft.filter((_, i) => i !== index))}>×</button>
					</div>
				{/each}
			</div>
			<div class="mt-3 flex gap-3 text-sm">
				<button type="button" onclick={addPeriod}>Stunde +</button>
				<button type="button" onclick={() => void saveTimes()}>Zeiten speichern</button>
			</div>
		</section>

		{#if periods.length}
			<form
				class="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
				onsubmit={(event) => {
					event.preventDefault();
					void addLesson();
				}}
			>
				<input class="placeholder:text-muted-foreground w-28 bg-transparent outline-none" bind:value={subject} placeholder="Fach" required />
				<select class="bg-transparent outline-none" bind:value={weekday}>
					{#each WEEKDAYS as day, index}
						<option value={index}>{day.slice(0, 2)}</option>
					{/each}
				</select>
				<select class="bg-transparent outline-none" bind:value={periodIndex}>
					{#each periods as period, index}
						<option value={index}>{period.label}. {formatMin(period.startMin)}</option>
					{/each}
				</select>
				<select class="bg-transparent outline-none" bind:value={length}>
					<option value="single">Einzelstunde</option>
					<option value="double">Doppelstunde</option>
				</select>
				<input class="placeholder:text-muted-foreground w-16 bg-transparent outline-none" bind:value={room} placeholder="Raum" />
				<button type="submit">+</button>
			</form>
		{/if}

		<div class="mt-6 grid grid-cols-5 gap-3 text-sm">
			{#each days as day, index}
				<div>
					<p class="text-muted-foreground mb-2 text-[11px] tracking-wide uppercase">{day.slice(0, 2)}</p>
					{#each lessons.filter((lesson) => lesson.weekday === index) as lesson}
						<div class="group mb-2">
							<p>{lesson.subject}</p>
							<p class="text-muted-foreground text-[11px]">
								{formatMin(lesson.startMin)}–{formatMin(lesson.endMin)}
								{#if lesson.room} {lesson.room}{/if}
								<button type="button" class="invisible group-hover:visible" onclick={() => hausi.deleteLesson(lesson.$id)}>×</button>
							</p>
						</div>
					{/each}
				</div>
			{/each}
		</div>
		{#if hausi.timetables.length}
			<button type="button" class="text-muted-foreground mt-8 text-xs" onclick={() => hausi.deleteTimetable(active.$id)}>Plan löschen</button>
		{/if}
	{:else}
		<p class="text-muted-foreground mt-8 text-sm">Namen für den ersten Plan eingeben, z. B. Normalwoche.</p>
	{/if}
</div>
