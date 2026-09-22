<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { daysLeft, formatWhen } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';

	let showDone = $state(false);
	const visible = $derived(
		hausi.tasks.filter((task) => (showDone ? task.done : !task.done) && !hausi.isExpired(task))
	);

	function openNew() {
		if (window.hausiDesktop) window.hausiDesktop.openCapture();
		else hausi.captureOpen = true;
	}
</script>

<div class="space-y-4 pb-24 md:pb-8">
	<div class="flex items-end justify-between gap-3">
		<div>
			<h1 class="font-serif text-4xl">Aufgaben</h1>
			<p class="text-muted-foreground text-sm">
				{hausi.profile?.premium ? 'Premium: Aufgaben bleiben.' : 'Ohne Premium bleiben sie 2 Monate.'}
			</p>
		</div>
		<Button onclick={openNew} disabled={!hausi.hasSchedule}><Plus class="size-4" /> Neu</Button>
	</div>

	{#if !hausi.hasSchedule}
		<p class="bg-card text-muted-foreground rounded-3xl border p-6 text-sm">
			Erst einen Stundenplan mit mindestens einer Stunde anlegen. Danach kannst du Aufgaben erfassen.
			<a class="text-primary ml-1" href="/app/stundenplan">Zum Stundenplan</a>
		</p>
	{:else}
		<div class="flex gap-2">
			<Button variant={showDone ? 'outline' : 'default'} size="sm" onclick={() => (showDone = false)}>Offen</Button>
			<Button variant={showDone ? 'default' : 'outline'} size="sm" onclick={() => (showDone = true)}>Erledigt</Button>
		</div>
		<div class="space-y-2">
			{#each visible as task}
				<article class="bg-card flex items-start gap-3 rounded-3xl border px-4 py-3">
					<Checkbox checked={task.done} onCheckedChange={() => hausi.toggleTask(task)} />
					<div class="min-w-0 flex-1">
						<a class="font-medium {task.done ? 'text-muted-foreground line-through' : ''}" href="/app/aufgaben/{task.$id}">
							{task.title}
						</a>
						<p class="text-muted-foreground mt-1 text-xs">
							{task.subject || 'Ohne Fach'}
							{#if task.remindAt} · Erinnerung {formatWhen(task.remindAt)}{/if}
							{#if task.pending} · wartet aufs Internet{/if}
							{#if daysLeft(task.expiresAt) !== null}
								· noch {daysLeft(task.expiresAt)} Tage
							{/if}
						</p>
					</div>
					{#if task.subject}<Badge variant="secondary">{task.subject}</Badge>{/if}
					<button type="button" class="text-muted-foreground hover:text-destructive" onclick={() => hausi.deleteTask(task)}>
						<Trash2 class="size-4" />
					</button>
				</article>
			{:else}
				<p class="text-muted-foreground text-sm">Hier ist noch nichts.</p>
			{/each}
		</div>
	{/if}
</div>
