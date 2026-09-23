<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import { formatDue, isOverdue } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';
	import type { Task } from '$lib/types';

	let { task, showSubject = true }: { task: Task; showSubject?: boolean } = $props();
	const overdue = $derived(!task.done && isOverdue(task.remindAt));
</script>

<div class="group hover:bg-accent/70 flex items-center gap-3 rounded-xl px-3 py-2.5">
	<button
		type="button"
		role="checkbox"
		aria-checked={task.done}
		aria-label={task.done ? 'Wieder öffnen' : 'Erledigt'}
		class="grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] {task.done
			? 'bg-foreground border-foreground text-background'
			: 'border-muted-foreground/50 hover:border-foreground'}"
		onclick={() => hausi.toggleTask(task)}
	>
		{#if task.done}<Check class="size-3" strokeWidth={3} />{/if}
	</button>
	<a href="/app/aufgaben/{task.$id}" class="flex min-w-0 flex-1 items-center gap-3">
		<span class="min-w-0 flex-1">
			<span class="block truncate text-[14.5px] font-medium {task.done ? 'text-muted-foreground line-through decoration-1' : ''}">
				{task.title}
			</span>
			{#if (showSubject && task.subject) || task.details}
				<span class="text-muted-foreground mt-0.5 block truncate text-xs">
					{#if showSubject && task.subject}<span class="text-foreground/70 font-medium">{task.subject}</span>{/if}
					{#if showSubject && task.subject && task.details}<span class="px-1">·</span>{/if}
					{task.details}
				</span>
			{/if}
		</span>
		<span class="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
			{#if task.pending}<CloudOff class="size-3.5" aria-label="Noch nicht synchronisiert" />{/if}
			{#if task.fileIds.length}<Paperclip class="size-3.5" />{/if}
			{#if hausi.shareOf(task.$id)}<Link2 class="size-3.5" />{/if}
			{#if task.remindAt}
				<span class="tabular {overdue ? 'text-foreground font-semibold' : ''}">{formatDue(task.remindAt)}</span>
			{/if}
		</span>
	</a>
</div>
