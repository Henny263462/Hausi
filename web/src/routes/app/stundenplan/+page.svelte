<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatMin, parseTime, subjectColor, WEEKDAYS } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	let planName = $state('');
	let subject = $state('');
	let weekday = $state(0);
	let start = $state('08:00');
	let end = $state('08:45');
	let room = $state('');
	let weekend = $state(false);

	const active = $derived(hausi.activeTimetable);
	const days = $derived(weekend ? WEEKDAYS : WEEKDAYS.slice(0, 5));
	const lessons = $derived(
		hausi.lessons
			.filter((lesson) => lesson.timetableId === active?.$id)
			.slice()
			.sort((a, b) => a.startMin - b.startMin)
	);

	async function createPlan() {
		if (!planName.trim()) return;
		await hausi.createTimetable(planName.trim());
		planName = '';
	}

	async function addLesson() {
		if (!active || !subject.trim()) return;
		const startMin = parseTime(start);
		const endMin = parseTime(end);
		if (endMin <= startMin) {
			hausi.ping('Das Ende muss nach dem Start liegen.', 'warn');
			return;
		}
		await hausi.addLesson({
			timetableId: active.$id,
			subject: subject.trim(),
			weekday,
			startMin,
			endMin,
			room: room.trim(),
			color: subjectColor(subject.trim())
		});
		subject = '';
		room = '';
	}
</script>

<div class="space-y-5 pb-24 md:pb-8">
	<div>
		<h1 class="font-serif text-4xl">Stundenplan</h1>
		<p class="text-muted-foreground text-sm">Mehrere Pläne, einer ist aktiv. Aufgaben richten sich nach dem aktiven Plan.</p>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		{#each hausi.timetables as plan}
			<button
				type="button"
				class="rounded-full border px-3 py-1 text-sm {plan.$id === active?.$id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}"
				onclick={() => hausi.activateTimetable(plan.$id)}
			>
				{plan.name}
				{#if plan.$id === active?.$id}<Badge class="ml-1" variant="secondary">aktiv</Badge>{/if}
			</button>
		{/each}
		<form class="flex gap-2" onsubmit={(event) => { event.preventDefault(); void createPlan(); }}>
			<Input bind:value={planName} placeholder="Neuer Plan, z. B. Woche A" class="w-52" />
			<Button type="submit" variant="outline"><Plus class="size-4" /> Plan</Button>
		</form>
		{#if active}
			<Button variant="ghost" onclick={() => hausi.deleteTimetable(active.$id)}>Plan löschen</Button>
		{/if}
	</div>

	{#if active}
		<form class="bg-card grid gap-3 rounded-3xl border p-4 md:grid-cols-6" onsubmit={(event) => { event.preventDefault(); void addLesson(); }}>
			<Input class="md:col-span-2" bind:value={subject} placeholder="Fach" required />
			<select class="border-input bg-background rounded-lg border px-2 text-sm" bind:value={weekday}>
				{#each WEEKDAYS as day, index}
					<option value={index}>{day}</option>
				{/each}
			</select>
			<Input type="time" bind:value={start} />
			<Input type="time" bind:value={end} />
			<div class="flex gap-2">
				<Input bind:value={room} placeholder="Raum" />
				<Button type="submit" size="icon"><Plus class="size-4" /></Button>
			</div>
		</form>

		<label class="text-muted-foreground flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={weekend} /> Wochenende zeigen
		</label>

		<div class="grid gap-3 md:grid-cols-5">
			{#each days as day, index}
				<section class="bg-card min-h-40 rounded-3xl border p-3">
					<h2 class="mb-2 text-sm font-medium">{day}</h2>
					<div class="space-y-2">
						{#each lessons.filter((lesson) => lesson.weekday === index) as lesson}
							<article class="rounded-2xl border px-2 py-2 text-sm" style:border-left-color={lesson.color} style:border-left-width="4px">
								<div class="flex items-start justify-between gap-2">
									<div>
										<p class="font-medium">{lesson.subject}</p>
										<p class="text-muted-foreground text-xs">
											{formatMin(lesson.startMin)}–{formatMin(lesson.endMin)}
											{#if lesson.room} · {lesson.room}{/if}
										</p>
									</div>
									<button type="button" class="text-muted-foreground" onclick={() => hausi.deleteLesson(lesson.$id)}>
										<Trash2 class="size-3.5" />
									</button>
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else}
		<p class="text-muted-foreground text-sm">Gib dem ersten Plan einen Namen, zum Beispiel „Normalwoche“.</p>
	{/if}
</div>
