<script lang="ts">
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { formatMin, jsWeekday, nextLesson, WEEKDAYS } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	const next = $derived(nextLesson(hausi.activeLessons));
	const today = $derived(jsWeekday());
	const todayLessons = $derived(
		hausi.activeLessons.filter((lesson) => lesson.weekday === today).sort((a, b) => a.startMin - b.startMin)
	);
	const todaySubjects = $derived(new Set(todayLessons.map((lesson) => lesson.subject)));
	const dueToday = $derived(
		hausi.openTasks.filter((task) => {
			if (task.subject && todaySubjects.has(task.subject)) return true;
			if (!task.remindAt) return false;
			const at = new Date(task.remindAt);
			return at.getDate() === new Date().getDate() && at.getMonth() === new Date().getMonth();
		})
	);
	const rest = $derived(hausi.openTasks.filter((task) => !dueToday.includes(task)).slice(0, 8));
</script>

<div>
	<p class="text-muted-foreground text-xs">{WEEKDAYS[today]}</p>
	<h1 class="mt-0.5 text-xl font-semibold tracking-tight">
		{hausi.user?.name ? hausi.user.name.split(' ')[0] : 'Heute'}
	</h1>

	{#if !hausi.hasSchedule}
		<p class="mt-8 text-sm">
			Noch kein Stundenplan.
			<a class="underline underline-offset-2" href="/app/stundenplan">Anlegen</a>
		</p>
	{:else}
		{#if next}
			<p class="mt-5 text-sm">
				Als Nächstes <span class="font-medium">{next.lesson.subject}</span>
				<span class="text-muted-foreground">
					{WEEKDAYS[next.lesson.weekday]} {formatMin(next.lesson.startMin)}{#if next.lesson.room} {next.lesson.room}{/if}
				</span>
			</p>
		{/if}

		{#if todayLessons.length}
			<p class="text-muted-foreground mt-2 text-xs">
				{#each todayLessons as lesson, i}{i ? ' · ' : ''}{formatMin(lesson.startMin)} {lesson.subject}{/each}
			</p>
		{/if}

		<section class="mt-8">
			<p class="text-muted-foreground mb-1 text-xs">Heute fällig</p>
			{#each dueToday as task}
				<TaskRow {task} />
			{:else}
				<p class="text-muted-foreground py-2 text-sm">Nichts für heute.</p>
			{/each}
		</section>

		{#if rest.length}
			<section class="mt-8">
				<div class="mb-1 flex items-baseline justify-between">
					<p class="text-muted-foreground text-xs">Offen</p>
					<a class="text-muted-foreground text-xs underline-offset-2 hover:underline" href="/app/aufgaben">alle</a>
				</div>
				{#each rest as task}
					<TaskRow {task} />
				{/each}
			</section>
		{/if}
	{/if}
</div>
