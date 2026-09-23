<script lang="ts">
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { hausi } from '$lib/store.svelte';

	let showDone = $state(false);
	const visible = $derived(hausi.tasks.filter((task) => (showDone ? task.done : !task.done) && !hausi.isExpired(task)));
</script>

<div>
	<div class="flex items-baseline justify-between gap-3">
		<h1 class="text-xl font-semibold tracking-tight">Aufgaben</h1>
		<div class="text-muted-foreground flex gap-3 text-xs">
			<button type="button" class={showDone ? '' : 'text-foreground'} onclick={() => (showDone = false)}>offen</button>
			<button type="button" class={showDone ? 'text-foreground' : ''} onclick={() => (showDone = true)}>erledigt</button>
		</div>
	</div>

	{#if !hausi.hasSchedule}
		<p class="mt-8 text-sm">
			Erst den <a class="underline underline-offset-2" href="/app/stundenplan">Stundenplan</a> anlegen.
		</p>
	{:else}
		<div class="mt-4">
			{#each visible as task}
				<TaskRow {task} />
			{:else}
				<p class="text-muted-foreground py-6 text-sm">Leer.</p>
			{/each}
		</div>
	{/if}
</div>
