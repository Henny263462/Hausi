<script lang="ts">
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { openCapture } from '$lib/open';
	import { hausi } from '$lib/store.svelte';
	import type { Task } from '$lib/types';

	let showDone = $state(page.url.searchParams.get('filter') === 'done');
	let query = $state('');
	let grouping = $state<'subject' | 'date'>('subject');

	const visible = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return hausi.tasks
			.filter((task) => task.done === showDone && !hausi.isExpired(task))
			.filter(
				(task) =>
					!needle ||
					task.title.toLowerCase().includes(needle) ||
					task.details.toLowerCase().includes(needle) ||
					task.subject.toLowerCase().includes(needle)
			)
			.sort((a, b) => {
				const at = a.remindAt ? new Date(a.remindAt).getTime() : Infinity;
				const bt = b.remindAt ? new Date(b.remindAt).getTime() : Infinity;
				return at - bt || b.$createdAt.localeCompare(a.$createdAt);
			});
	});

	function dateGroup(task: Task) {
		if (!task.remindAt) return 'Ohne Termin';
		const date = new Date(task.remindAt);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const day = new Date(date);
		day.setHours(0, 0, 0, 0);
		const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
		if (diff < 0) return 'Überfällig';
		if (diff === 0) return 'Heute';
		if (diff === 1) return 'Morgen';
		if (diff < 7) return 'Diese Woche';
		return 'Später';
	}

	const groups = $derived.by(() => {
		const map = new Map<string, Task[]>();
		for (const task of visible) {
			const key = grouping === 'subject' ? task.subject || 'Ohne Fach' : dateGroup(task);
			map.set(key, [...(map.get(key) ?? []), task]);
		}
		const order = ['Überfällig', 'Heute', 'Morgen', 'Diese Woche', 'Später', 'Ohne Termin'];
		return [...map.entries()].sort(([a], [b]) =>
			grouping === 'date'
				? order.indexOf(a) - order.indexOf(b)
				: a === 'Ohne Fach'
					? 1
					: b === 'Ohne Fach'
						? -1
						: a.localeCompare(b, 'de')
		);
	});
</script>

<PageHeader
	eyebrow="Übersicht"
	title="Aufgaben"
	description="{hausi.openTasks.length} offen · {hausi.tasks.filter((task) => task.done).length} erledigt"
>
	{#snippet actions()}
		<button type="button" class="btn btn-primary" disabled={!hausi.hasSchedule} onclick={openCapture}>
			<Plus class="size-4" /> Neue Aufgabe
		</button>
	{/snippet}
</PageHeader>

{#if !hausi.hasSchedule}
	<div class="card rise px-6 py-12 text-center">
		<p class="text-sm">Erst den Stundenplan anlegen, dann kannst du Aufgaben erfassen.</p>
		<a class="btn btn-outline mt-4" href="/app/stundenplan">Zum Stundenplan</a>
	</div>
{:else}
	<div class="rise mb-4 flex flex-wrap items-center gap-2">
		<div class="seg">
			<button type="button" aria-pressed={!showDone} onclick={() => (showDone = false)}>Offen</button>
			<button type="button" aria-pressed={showDone} onclick={() => (showDone = true)}>Erledigt</button>
		</div>
		<div class="seg">
			<button type="button" aria-pressed={grouping === 'subject'} onclick={() => (grouping = 'subject')}>Nach Fach</button>
			<button type="button" aria-pressed={grouping === 'date'} onclick={() => (grouping = 'date')}>Nach Termin</button>
		</div>
		<label class="relative ml-auto w-full sm:w-64">
			<Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<input bind:value={query} class="field h-9 pl-9" placeholder="Suchen" />
		</label>
	</div>

	{#if groups.length}
		<div class="space-y-4">
			{#each groups as [name, items] (name)}
				<section class="card rise p-2">
					<div class="flex items-center justify-between px-3 pt-2.5 pb-1">
						<h3 class="text-sm font-semibold">{name}</h3>
						<span class="tabular text-muted-foreground text-xs">{items.length}</span>
					</div>
					{#each items as task (task.$id)}
						<TaskRow {task} showSubject={grouping !== 'subject'} />
					{/each}
				</section>
			{/each}
		</div>
	{:else}
		<div class="card rise flex flex-col items-center px-6 py-14 text-center">
			<span class="bg-secondary grid size-12 place-items-center rounded-2xl"><ListChecks class="size-5" /></span>
			<p class="mt-4 text-sm font-medium">
				{query ? 'Nichts gefunden.' : showDone ? 'Noch nichts erledigt.' : 'Alles erledigt.'}
			</p>
			{#if !query && !showDone}
				<p class="text-muted-foreground mt-1 text-sm">Neue Aufgabe mit <span class="kbd">N</span> oder dem Hotkey.</p>
			{/if}
		</div>
	{/if}
{/if}
