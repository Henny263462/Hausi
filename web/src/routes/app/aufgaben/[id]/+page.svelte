<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Download from '@lucide/svelte/icons/download';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { daysLeft, formatWhen } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	const task = $derived(hausi.tasks.find((item) => item.$id === page.params.id));
	let title = $state('');
	let details = $state('');
	let loaded = $state('');

	$effect(() => {
		if (!task || loaded === task.$id) return;
		title = task.title;
		details = task.details;
		loaded = task.$id;
	});

	async function save() {
		if (!task || task.pending) return;
		await hausi.updateTask(task.$id, { title, details });
		hausi.ping('Gespeichert.');
	}
</script>

{#if !task}
	<p class="text-muted-foreground text-sm">Diese Aufgabe gibt es nicht.</p>
{:else}
	<div class="mx-auto max-w-2xl space-y-4 pb-24">
		<a class="text-muted-foreground inline-flex items-center gap-1 text-sm" href="/app/aufgaben">
			<ArrowLeft class="size-4" /> Zurück
		</a>
		<Input bind:value={title} class="font-serif h-12 text-2xl" />
		<Textarea bind:value={details} rows={6} />
		<p class="text-muted-foreground text-xs">
			{task.subject || 'Ohne Fach'}
			{#if task.remindAt} · E-Mail {formatWhen(task.remindAt)}{/if}
			{#if daysLeft(task.expiresAt) !== null} · noch {daysLeft(task.expiresAt)} Tage gespeichert{/if}
		</p>
		<div class="flex flex-wrap gap-2">
			<Button onclick={save} disabled={task.pending}>Speichern</Button>
			<Button variant="outline" onclick={() => hausi.toggleTask(task)}>
				{task.done ? 'Wieder öffnen' : 'Erledigt'}
			</Button>
			<Button
				variant="ghost"
				onclick={async () => {
					await hausi.deleteTask(task);
					goto('/app/aufgaben');
				}}>Löschen</Button
			>
		</div>
		<section class="bg-card rounded-3xl border p-4">
			<p class="mb-3 flex items-center gap-2 text-sm font-medium"><Paperclip class="size-4" /> Dateien</p>
			<ul class="space-y-2">
				{#each task.fileIds as fileId}
					<li>
						<button type="button" class="text-primary inline-flex items-center gap-2 text-sm" onclick={() => hausi.downloadFile(fileId)}>
							<Download class="size-4" /> {fileId}
						</button>
					</li>
				{:else}
					<li class="text-muted-foreground text-sm">Noch kein Anhang.</li>
				{/each}
			</ul>
			<label class="mt-3 inline-block">
				<input
					class="hidden"
					type="file"
					multiple
					disabled={task.pending}
					onchange={(event) => {
						const list = event.currentTarget.files;
						if (list) void hausi.attachFiles(task, Array.from(list));
						event.currentTarget.value = '';
					}}
				/>
				<span class="border-input inline-flex cursor-pointer rounded-xl border px-3 py-2 text-sm">Datei anhängen</span>
			</label>
		</section>
	</div>
{/if}
