<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock3 from '@lucide/svelte/icons/clock-3';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { daysLeft, formatMin, formatWhen, jsWeekday, nextLesson, WEEKDAYS } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	const next = $derived(nextLesson(hausi.activeLessons));
	const today = $derived(jsWeekday());
	const todayLessons = $derived(
		hausi.activeLessons.filter((lesson) => lesson.weekday === today).sort((a, b) => a.startMin - b.startMin)
	);
	const soon = $derived(
		hausi.openTasks
			.slice()
			.sort((a, b) => (a.remindAt ?? '9999').localeCompare(b.remindAt ?? '9999'))
			.slice(0, 6)
	);
</script>

<div class="space-y-6 pb-24 md:pb-8">
	<div>
		<p class="text-muted-foreground text-sm">{WEEKDAYS[today]}</p>
		<h1 class="font-serif text-4xl">Hallo{hausi.user?.name ? `, ${hausi.user.name.split(' ')[0]}` : ''}.</h1>
	</div>

	{#if !hausi.hasSchedule}
		<section class="bg-card rounded-3xl border p-6">
			<CalendarPlus class="text-primary mb-3 size-6" />
			<h2 class="font-serif text-2xl">Zuerst der Stundenplan</h2>
			<p class="text-muted-foreground mt-2 max-w-lg text-sm">
				Aufgaben hängen an deinen Stunden. Leg einen Plan an, danach kannst du Aufgaben und Notizen erfassen.
			</p>
			<Button class="mt-4" href="/app/stundenplan">Stundenplan anlegen <ArrowRight class="size-4" /></Button>
		</section>
	{:else}
		<div class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
			<section class="bg-card rounded-3xl border p-5">
				<p class="text-muted-foreground mb-2 flex items-center gap-2 text-xs tracking-wide uppercase">
					<Clock3 class="size-3.5" /> Als Nächstes
				</p>
				{#if next}
					<p class="font-serif text-3xl">{next.lesson.subject}</p>
					<p class="text-muted-foreground mt-1 text-sm">
						{WEEKDAYS[next.lesson.weekday]} · {formatMin(next.lesson.startMin)}–{formatMin(next.lesson.endMin)}
						{#if next.lesson.room}· {next.lesson.room}{/if}
					</p>
				{:else}
					<p class="text-muted-foreground text-sm">Keine kommende Stunde im aktiven Plan.</p>
				{/if}
				<div class="mt-4 space-y-2">
					{#each todayLessons as lesson}
						<div class="flex items-center gap-3 text-sm">
							<span class="size-2.5 rounded-full" style:background={lesson.color || '#c45c26'}></span>
							<span class="w-24 text-muted-foreground">{formatMin(lesson.startMin)}</span>
							<span>{lesson.subject}</span>
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">Heute steht nichts im Plan.</p>
					{/each}
				</div>
			</section>

			<section class="bg-card rounded-3xl border p-5">
				<div class="mb-3 flex items-center justify-between">
					<p class="font-serif text-xl">Offen</p>
					<a class="text-primary text-sm" href="/app/aufgaben">Alle</a>
				</div>
				<div class="space-y-2">
					{#each soon as task}
						<div class="flex items-start gap-3 rounded-2xl border px-3 py-2">
							<Checkbox checked={task.done} onCheckedChange={() => hausi.toggleTask(task)} />
							<div class="min-w-0">
								<a class="block truncate text-sm font-medium" href="/app/aufgaben/{task.$id}">{task.title}</a>
								<p class="text-muted-foreground text-xs">
									{task.subject || 'Ohne Fach'}
									{#if task.remindAt} · {formatWhen(task.remindAt)}{/if}
									{#if daysLeft(task.expiresAt) !== null} · noch {daysLeft(task.expiresAt)} Tage{/if}
								</p>
							</div>
						</div>
					{:else}
						<p class="text-muted-foreground flex items-center gap-2 text-sm">
							<CircleCheck class="size-4" /> Nichts liegt offen.
						</p>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</div>
