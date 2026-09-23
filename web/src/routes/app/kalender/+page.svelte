<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatWhen, isToday } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	let title = $state('');
	let details = $state('');
	let subject = $state('');
	let startsAt = $state('');
	let kind = $state<'exam' | 'event'>('exam');
	let open = $state(false);

	const grouped = $derived.by(() => {
		const map = new Map<string, typeof hausi.bookEvents>();
		for (const item of [...hausi.bookEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
			const day = new Date(item.startsAt);
			day.setHours(0, 0, 0, 0);
			const key = day.toISOString();
			map.set(key, [...(map.get(key) ?? []), item]);
		}
		return [...map.entries()];
	});

	function dayLabel(iso: string) {
		const date = new Date(iso);
		if (isToday(iso)) return 'Heute';
		return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
	}

	async function save() {
		if (!title.trim() || !startsAt) return;
		await hausi.createEvent({
			title: title.trim(),
			details: details.trim(),
			subject,
			startsAt: new Date(startsAt).toISOString(),
			kind
		});
		title = '';
		details = '';
		startsAt = '';
		open = false;
	}
</script>

<PageHeader
	eyebrow={hausi.activeBook?.kind === 'shared' ? hausi.activeBook.name : 'Privat'}
	title="Kalender"
	description="Klassenarbeiten und andere Termine im aktuellen Buch."
>
	{#snippet actions()}
		<button type="button" class="btn btn-primary" onclick={() => (open = !open)}><Plus class="size-4" /> Termin</button>
	{/snippet}
</PageHeader>

{#if open}
	<form class="card rise mb-6 space-y-3 p-5" onsubmit={(event) => { event.preventDefault(); void save(); }}>
		<div class="seg">
			<button type="button" aria-pressed={kind === 'exam'} onclick={() => (kind = 'exam')}>Klassenarbeit</button>
			<button type="button" aria-pressed={kind === 'event'} onclick={() => (kind = 'event')}>Termin</button>
		</div>
		<input bind:value={title} class="field" placeholder="Titel" required />
		<input bind:value={startsAt} class="field" type="datetime-local" required />
		<select class="field" bind:value={subject}>
			<option value="">Ohne Fach</option>
			{#each hausi.subjects as item}
				<option value={item}>{item}</option>
			{/each}
		</select>
		<textarea bind:value={details} class="field min-h-24 py-2" placeholder="Themen, Raum, Hinweise …"></textarea>
		<div class="flex gap-2">
			<button type="submit" class="btn btn-primary">Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (open = false)}>Abbrechen</button>
		</div>
	</form>
{/if}

<div class="space-y-4">
	{#each grouped as [day, items] (day)}
		<section class="card rise p-2">
			<h2 class="px-3 pt-2.5 pb-1 text-sm font-semibold">{dayLabel(items[0]?.startsAt ?? day)}</h2>
			{#each items as item (item.$id)}
				<div class="flex items-start gap-3 rounded-xl px-3 py-2.5">
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{item.title}</p>
						<p class="text-muted-foreground text-xs">
							{item.kind === 'exam' ? 'Klassenarbeit' : 'Termin'} · {formatWhen(item.startsAt)}
							{#if item.subject} · {item.subject}{/if}
						</p>
						{#if item.details}
							<p class="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{item.details}</p>
						{/if}
					</div>
					<button type="button" class="btn btn-ghost btn-icon size-8" title="Löschen" onclick={() => hausi.deleteEvent(item.$id)}>
						<Trash2 class="size-4" />
					</button>
				</div>
			{/each}
		</section>
	{:else}
		<div class="card rise px-6 py-12 text-center">
			<p class="text-sm font-medium">Noch keine Termine in diesem Buch.</p>
			<p class="text-muted-foreground mt-1 text-sm">Leg eine Klassenarbeit oder einen anderen Termin an.</p>
		</div>
	{/each}
</div>
