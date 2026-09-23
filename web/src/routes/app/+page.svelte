<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { openCapture } from '$lib/open';
	import {
		currentLesson,
		formatMin,
		greeting,
		isToday,
		jsWeekday,
		longDate,
		nextLesson,
		nowMinutes,
		WEEKDAYS
	} from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	let tick = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (tick = Date.now()), 30_000);
		return () => clearInterval(id);
	});

	const now = $derived(new Date(tick));
	const minute = $derived(nowMinutes(now));
	const today = $derived(jsWeekday(now));
	const current = $derived(currentLesson(hausi.activeLessons, now));
	const next = $derived(nextLesson(hausi.activeLessons, now));
	const todayLessons = $derived(
		hausi.activeLessons.filter((lesson) => lesson.weekday === today).sort((a, b) => a.startMin - b.startMin)
	);
	const todaySubjects = $derived(new Set(todayLessons.map((lesson) => lesson.subject)));
	const dueToday = $derived(
		hausi.openTasks.filter((task) => isToday(task.remindAt) || (!task.remindAt && todaySubjects.has(task.subject)))
	);
	const rest = $derived(hausi.openTasks.filter((task) => !dueToday.includes(task)).slice(0, 6));
	const doneCount = $derived(hausi.tasks.filter((task) => task.done).length);
	const firstName = $derived(hausi.user?.name?.split(' ')[0] ?? '');

	const progress = $derived(
		current ? Math.min(1, Math.max(0, (minute - current.startMin) / (current.endMin - current.startMin))) : 0
	);
	const minutesUntil = $derived(next ? Math.max(0, Math.round((next.at.getTime() - tick) / 60_000)) : 0);

	function untilLabel(minutes: number) {
		if (minutes < 60) return `in ${minutes} Min.`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `in ${hours} Std. ${minutes % 60 ? `${minutes % 60} Min.` : ''}`.trim();
		return `am ${WEEKDAYS[next!.lesson.weekday]}`;
	}
</script>

<PageHeader eyebrow={longDate(now)} title={firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}>
	{#snippet actions()}
		<button type="button" class="btn btn-primary hidden md:inline-flex" disabled={!hausi.hasSchedule} onclick={openCapture}>
			<Plus class="size-4" /> Neu <span class="kbd border-current/20 bg-transparent text-current/70">N</span>
		</button>
	{/snippet}
</PageHeader>

{#if !hausi.hasSchedule}
	<div class="card rise flex flex-col items-center px-6 py-14 text-center">
		<span class="bg-secondary grid size-12 place-items-center rounded-2xl"><CalendarPlus class="size-5" /></span>
		<h2 class="mt-4 text-lg font-semibold tracking-tight">Leg zuerst deinen Stundenplan an</h2>
		<p class="text-muted-foreground mt-1.5 max-w-sm text-sm">
			Hausi hängt jede Aufgabe an das passende Fach und erinnert dich zur nächsten Stunde.
		</p>
		<a href="/app/stundenplan" class="btn btn-primary mt-6">Stundenplan anlegen <ArrowRight class="size-4" /></a>
	</div>
{:else}
	<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
		<div class="min-w-0 space-y-6">
			<section class="rise bg-primary text-primary-foreground relative overflow-hidden rounded-2xl p-6 shadow-float">
				<div class="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-current opacity-[0.04]"></div>
				{#if current}
					<p class="text-[11px] font-medium tracking-[0.14em] uppercase opacity-60">
						Jetzt · bis {formatMin(current.endMin)}
					</p>
					<h2 class="mt-2 text-[34px] leading-none font-semibold tracking-[-0.03em]">{current.subject}</h2>
					<p class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-70">
						<span class="tabular">{formatMin(current.startMin)}–{formatMin(current.endMin)}</span>
						{#if current.room}<span class="flex items-center gap-1"><MapPin class="size-3.5" />{current.room}</span>{/if}
						<span>noch {current.endMin - minute} Min.</span>
					</p>
					<div class="mt-5 h-1 overflow-hidden rounded-full bg-current/15">
						<div class="h-full rounded-full bg-current transition-[width] duration-700" style:width="{progress * 100}%"></div>
					</div>
				{:else if next}
					<p class="text-[11px] font-medium tracking-[0.14em] uppercase opacity-60">
						Als Nächstes · {untilLabel(minutesUntil)}
					</p>
					<h2 class="mt-2 text-[34px] leading-none font-semibold tracking-[-0.03em]">{next.lesson.subject}</h2>
					<p class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-70">
						<span class="tabular">{WEEKDAYS[next.lesson.weekday]}, {formatMin(next.lesson.startMin)}</span>
						{#if next.lesson.room}<span class="flex items-center gap-1"><MapPin class="size-3.5" />{next.lesson.room}</span>{/if}
					</p>
				{/if}
				<div class="mt-6 flex flex-wrap gap-2">
					<button
						type="button"
						class="btn btn-sm bg-primary-foreground text-primary hover:opacity-90"
						onclick={openCapture}
					>
						<Plus class="size-3.5" /> Aufgabe{current ? ` für ${current.subject}` : ''}
					</button>
					<a href="/app/stundenplan" class="btn btn-sm hover:bg-current/10">Wochenplan</a>
				</div>
			</section>

			<div class="rise grid grid-cols-3 gap-3">
				{#each [{ label: 'Offen', value: hausi.openTasks.length, href: '/app/aufgaben' }, { label: 'Heute fällig', value: dueToday.length, href: '/app/aufgaben' }, { label: 'Erledigt', value: doneCount, href: '/app/aufgaben?filter=done' }] as stat}
					<a href={stat.href} class="card hover:border-foreground/20 px-4 py-3.5">
						<p class="tabular text-2xl font-semibold tracking-tight">{stat.value}</p>
						<p class="text-muted-foreground mt-0.5 text-xs">{stat.label}</p>
					</a>
				{/each}
			</div>

			<section class="card rise p-2">
				<div class="flex items-center justify-between px-3 pt-2.5 pb-1.5">
					<h3 class="text-sm font-semibold">Heute fällig</h3>
					<span class="tabular text-muted-foreground text-xs">{dueToday.length}</span>
				</div>
				{#each dueToday as task (task.$id)}
					<TaskRow {task} />
				{:else}
					<p class="text-muted-foreground px-3 pt-1 pb-3 text-sm">Nichts fällig. Genieß den Tag.</p>
				{/each}
			</section>

			{#if rest.length}
				<section class="card rise p-2">
					<div class="flex items-center justify-between px-3 pt-2.5 pb-1.5">
						<h3 class="text-sm font-semibold">Weitere offene Aufgaben</h3>
						<a href="/app/aufgaben" class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs">
							Alle <ArrowRight class="size-3" />
						</a>
					</div>
					{#each rest as task (task.$id)}
						<TaskRow {task} />
					{/each}
				</section>
			{/if}
		</div>

		<aside class="card rise h-fit p-5">
			<div class="flex items-baseline justify-between">
				<h3 class="text-sm font-semibold">Stunden heute</h3>
				<span class="text-muted-foreground text-xs">{WEEKDAYS[today]}</span>
			</div>
			{#if todayLessons.length}
				<ol class="relative mt-4">
					<span class="bg-border absolute top-2 bottom-2 left-[5px] w-px"></span>
					{#each todayLessons as lesson (lesson.$id)}
						{@const past = lesson.endMin <= minute}
						{@const live = current?.$id === lesson.$id}
						<li class="relative flex gap-3.5 py-2 {past ? 'opacity-45' : ''}">
							<span
								class="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 {live
									? 'bg-foreground border-foreground ring-foreground/15 ring-4'
									: past
										? 'bg-muted-foreground border-muted-foreground'
										: 'bg-card border-muted-foreground/60'}"
							></span>
							<div class="min-w-0 flex-1">
								<p class="flex items-baseline justify-between gap-2">
									<span class="truncate text-sm {live ? 'font-semibold' : 'font-medium'}">{lesson.subject}</span>
									<span class="tabular text-muted-foreground shrink-0 text-xs">{formatMin(lesson.startMin)}</span>
								</p>
								<p class="text-muted-foreground text-xs">
									bis {formatMin(lesson.endMin)}{#if lesson.room} · {lesson.room}{/if}
								</p>
							</div>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="text-muted-foreground mt-3 text-sm">Heute ist frei.</p>
				{#if next}
					<p class="text-muted-foreground mt-1 text-xs">
						Weiter geht's {WEEKDAYS[next.lesson.weekday]} um {formatMin(next.lesson.startMin)} mit {next.lesson.subject}.
					</p>
				{/if}
			{/if}
		</aside>
	</div>
{/if}
