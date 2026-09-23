<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { daysLeft, formatWhen } from '$lib/schedule';
	import { hausi } from '$lib/store.svelte';
	import type { Task } from '$lib/types';

	let { task }: { task: Task } = $props();
	const left = $derived(daysLeft(task.expiresAt));
</script>

<div class="hover:bg-muted/70 group flex items-center gap-2 rounded-md px-1 py-1.5">
	<Checkbox checked={task.done} onCheckedChange={() => hausi.toggleTask(task)} />
	<a href="/app/aufgaben/{task.$id}" class="min-w-0 flex-1 leading-tight">
		<span class="block truncate text-[15px] {task.done ? 'text-muted-foreground line-through' : ''}">{task.title}</span>
		<span class="text-muted-foreground text-[12px]">
			{task.subject || 'Ohne Fach'}
			{#if task.remindAt} · {formatWhen(task.remindAt)}{/if}
			{#if task.pending} · offline{/if}
			{#if hausi.shareOf(task.$id)} · geteilt{/if}
			{#if left !== null} · {left}d{/if}
		</span>
	</a>
</div>
