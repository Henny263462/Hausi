<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Copy from '@lucide/svelte/icons/copy';
	import FileText from '@lucide/svelte/icons/file-text';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Switch } from '$lib/components/ui/switch';
	import { daysLeft, formatWhen } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	const task = $derived(hausi.tasks.find((item) => item.$id === page.params.id));
	const share = $derived(task ? hausi.shareOf(task.$id) : null);
	const left = $derived(task ? daysLeft(task.expiresAt) : null);
	const subjectOptions = $derived(
		task?.subject && !hausi.subjects.includes(task.subject) ? [task.subject, ...hausi.subjects] : hausi.subjects
	);
	let title = $state('');
	let details = $state('');
	let loaded = $state('');
	let sharing = $state(false);
	let saved = $state<'idle' | 'saving' | 'saved'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!task || loaded === task.$id) return;
		title = task.title;
		details = task.details;
		loaded = task.$id;
	});

	function queueSave() {
		saved = 'saving';
		clearTimeout(timer);
		timer = setTimeout(() => void save(), 450);
	}

	async function save() {
		if (!task) return;
		if (title.trim() && (title !== task.title || details !== task.details)) {
			await hausi.updateTask(task.$id, { title: title.trim(), details });
		}
		saved = 'saved';
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
				await hausi.revokeShare(task.$id, 'task', task.fileIds);
			}
		} catch {
			hausi.ping('Teilen hat nicht geklappt.', 'warn');
		} finally {
			sharing = false;
		}
	}
</script>

<a href="/app/aufgaben" class="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm">
	<ArrowLeft class="size-4" /> Aufgaben
</a>

{#if !task}
	<div class="card px-6 py-12 text-center">
		<p class="text-sm font-medium">Diese Aufgabe gibt es nicht mehr.</p>
		<a href="/app/aufgaben" class="btn btn-outline mt-4">Zur Übersicht</a>
	</div>
{:else}
	<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
		<div class="min-w-0 space-y-6">
			<section class="card rise p-6">
				<div class="mb-3 flex items-center gap-2">
					{#if task.subject}<span class="chip">{task.subject}</span>{/if}
					{#if task.done}<span class="chip bg-foreground text-background"><Check class="size-3" /> Erledigt</span>{/if}
					{#if task.pending}<span class="chip"><CloudOff class="size-3" /> Lokal</span>{/if}
					<span class="text-muted-foreground ml-auto text-xs">
						{saved === 'saving' ? 'Speichert…' : saved === 'saved' ? 'Gespeichert' : ''}
					</span>
				</div>
				<input
					bind:value={title}
					oninput={queueSave}
					class="w-full bg-transparent text-2xl font-semibold tracking-[-0.02em] outline-none {task.done ? 'text-muted-foreground line-through' : ''}"
					placeholder="Titel"
				/>
				<textarea
					bind:value={details}
					oninput={queueSave}
					rows={10}
					placeholder="Details, Seitenzahlen, Aufgabennummern …"
					class="placeholder:text-muted-foreground mt-4 w-full resize-none bg-transparent text-[15px] leading-7 outline-none"
				></textarea>
			</section>

			<section class="card rise p-5">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-semibold">Dateien</h3>
					<label class="btn btn-outline btn-sm cursor-pointer {task.pending || !hausi.online ? 'pointer-events-none opacity-40' : ''}">
						<Paperclip class="size-3.5" /> Anhängen
						<input
							class="hidden"
							type="file"
							multiple
							disabled={task.pending || !hausi.online}
							onchange={(event) => {
								const list = event.currentTarget.files;
								if (list) void hausi.attachFiles(task, Array.from(list));
								event.currentTarget.value = '';
							}}
						/>
					</label>
				</div>
				{#if task.fileIds.length}
					<ul class="mt-3 grid gap-2 sm:grid-cols-2">
						{#each task.fileIds as fileId, index}
							<li>
								<button
									type="button"
									class="hover:bg-accent flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
									onclick={() => hausi.downloadFile(fileId)}
								>
									<span class="bg-secondary grid size-8 place-items-center rounded-lg"><FileText class="size-4" /></span>
									<span class="min-w-0">
										<span class="block text-sm font-medium">Anhang {index + 1}</span>
										<span class="text-muted-foreground block truncate text-xs">Herunterladen</span>
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-muted-foreground mt-2 text-sm">
						{hausi.online ? 'Noch keine Dateien.' : 'Dateien anhängen geht nur online.'}
					</p>
				{/if}
			</section>
		</div>

		<aside class="space-y-4">
			<section class="card rise p-5">
				<button
					type="button"
					class="btn w-full {task.done ? 'btn-outline' : 'btn-primary'}"
					onclick={() => hausi.toggleTask(task)}
				>
					{#if task.done}<RotateCcw class="size-4" /> Wieder öffnen{:else}<Check class="size-4" /> Als erledigt markieren{/if}
				</button>
				<dl class="mt-5 space-y-3.5 text-sm">
					<div>
						<dt class="eyebrow mb-1.5">Fach</dt>
						<dd>
							<select
								class="field h-9"
								value={task.subject}
								onchange={(event) => hausi.updateTask(task.$id, { subject: event.currentTarget.value })}
							>
								<option value="">Ohne Fach</option>
								{#each subjectOptions as subject}
									<option value={subject}>{subject}</option>
								{/each}
							</select>
						</dd>
					</div>
					<div class="flex items-center justify-between gap-3">
						<dt class="text-muted-foreground">Erinnerung</dt>
						<dd class="tabular text-right">{task.remindAt ? formatWhen(task.remindAt) : 'Keine'}</dd>
					</div>
					<div class="flex items-center justify-between gap-3">
						<dt class="text-muted-foreground">Aufbewahrung</dt>
						<dd class="text-right">{left === null ? 'Unbegrenzt' : `noch ${left} Tage`}</dd>
					</div>
					<div class="flex items-center justify-between gap-3">
						<dt class="text-muted-foreground">Erstellt</dt>
						<dd class="tabular text-right">{formatWhen(task.$createdAt)}</dd>
					</div>
				</dl>
			</section>

			<section class="card rise p-5">
				<div class="flex items-center justify-between gap-3">
					<div>
						<h3 class="text-sm font-semibold">Teilen</h3>
						<p class="text-muted-foreground mt-0.5 text-xs">Jeder mit dem Link kann sie übernehmen.</p>
					</div>
					<Switch
						checked={!!share}
						disabled={sharing || task.pending || !hausi.online}
						onCheckedChange={(value) => toggleShare(!!value)}
					/>
				</div>
				{#if share}
					<button
						type="button"
						class="btn btn-outline btn-sm mt-4 w-full"
						onclick={async () => {
							await navigator.clipboard.writeText(hausi.shareLink(share.$id));
							hausi.ping('Link kopiert.');
						}}
					>
						<Copy class="size-3.5" /> Link kopieren
					</button>
				{/if}
			</section>

			<button
				type="button"
				class="btn btn-ghost w-full"
				onclick={async () => {
					await hausi.deleteTask(task);
					goto('/app/aufgaben');
				}}
			>
				<Trash2 class="size-4" /> Aufgabe löschen
			</button>
		</aside>
	</div>
{/if}
