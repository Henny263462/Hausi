<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { daysLeft, formatWhen } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	const task = $derived(hausi.tasks.find((item) => item.$id === page.params.id));
	const share = $derived(task ? hausi.shareOf(task.$id) : null);
	let title = $state('');
	let details = $state('');
	let loaded = $state('');
	let sharing = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!task || loaded === task.$id) return;
		title = task.title;
		details = task.details;
		loaded = task.$id;
	});

	function queueSave() {
		clearTimeout(timer);
		timer = setTimeout(() => void save(), 400);
	}

	async function save() {
		if (!task || task.pending) return;
		if (title === task.title && details === task.details) return;
		await hausi.updateTask(task.$id, { title, details });
	}

	async function toggleShare(next: boolean) {
		if (!task || sharing) return;
		sharing = true;
		try {
			if (next) {
				const url = await hausi.shareTask({ ...task, title, details });
				if (url) {
					await navigator.clipboard.writeText(url);
					hausi.ping('Link kopiert.');
				}
			} else {
				await hausi.revokeShare(task);
			}
		} finally {
			sharing = false;
		}
	}
</script>

{#if !task}
	<p class="text-muted-foreground text-sm">Nicht gefunden.</p>
{:else}
	<div class="space-y-5">
		<a class="text-muted-foreground text-xs" href="/app/aufgaben">← Aufgaben</a>
		<input
			bind:value={title}
			oninput={queueSave}
			class="w-full bg-transparent text-xl font-semibold tracking-tight outline-none"
		/>
		<textarea
			bind:value={details}
			oninput={queueSave}
			rows={8}
			placeholder="Details"
			class="placeholder:text-muted-foreground w-full resize-none bg-transparent text-sm leading-6 outline-none"
		></textarea>
		<p class="text-muted-foreground text-xs">
			{task.subject || 'Ohne Fach'}
			{#if task.remindAt} · {formatWhen(task.remindAt)}{/if}
			{#if daysLeft(task.expiresAt) !== null} · {daysLeft(task.expiresAt)} Tage{/if}
		</p>
		<div class="flex flex-wrap items-center gap-2">
			<Button size="sm" variant="secondary" onclick={() => hausi.toggleTask(task)}>
				{task.done ? 'Wieder öffnen' : 'Erledigt'}
			</Button>
			<Button
				size="sm"
				variant="ghost"
				onclick={async () => {
					await hausi.deleteTask(task);
					goto('/app/aufgaben');
				}}>Löschen</Button
			>
		</div>
		<div class="flex items-center justify-between gap-3 border-t pt-4">
			<div>
				<p class="text-sm">Teilen</p>
				{#if share}
					<button type="button" class="text-muted-foreground text-xs underline-offset-2 hover:underline" onclick={() => navigator.clipboard.writeText(hausi.shareLink(share.$id))}>
						Link kopieren
					</button>
				{/if}
			</div>
			<Switch checked={!!share} disabled={sharing || task.pending} onCheckedChange={(value) => toggleShare(!!value)} />
		</div>
		<div class="border-t pt-4">
			<p class="mb-2 text-sm">Dateien</p>
			<ul class="space-y-1 text-sm">
				{#each task.fileIds as fileId}
					<li>
						<button type="button" class="underline-offset-2 hover:underline" onclick={() => hausi.downloadFile(fileId)}>{fileId}</button>
					</li>
				{:else}
					<li class="text-muted-foreground text-xs">Keine.</li>
				{/each}
			</ul>
			<label class="mt-2 inline-block">
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
				<span class="text-muted-foreground cursor-pointer text-xs underline-offset-2 hover:underline">Anhängen</span>
			</label>
		</div>
	</div>
{/if}
