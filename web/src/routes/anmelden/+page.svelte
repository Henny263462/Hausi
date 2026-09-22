<script lang="ts">
	import { goto } from '$app/navigation';
	import BookOpenCheck from '@lucide/svelte/icons/book-open-check';
	import Mail from '@lucide/svelte/icons/mail';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { hausi } from '$lib/store.svelte';

	let mode = $state<'login' | 'register'>('login');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let pending = $state(false);

	$effect(() => {
		if (hausi.ready && hausi.user) goto('/app');
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		pending = true;
		try {
			if (mode === 'register') await hausi.register(name.trim(), email.trim(), password);
			else await hausi.login(email.trim(), password);
			goto('/app');
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : 'Das hat nicht geklappt.';
			error = message.includes('Invalid credentials')
				? 'E-Mail oder Passwort stimmt nicht.'
				: message.includes('already')
					? 'Diese E-Mail gibt es schon. Melde dich an.'
					: message;
		} finally {
			pending = false;
		}
	}
</script>

<div class="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-6 py-12 md:grid-cols-2">
	<div>
		<p class="text-primary mb-3 inline-flex items-center gap-2 text-sm font-medium">
			<BookOpenCheck class="size-4" /> Hausi
		</p>
		<h1 class="font-serif text-5xl leading-tight">Hausaufgaben, solange die Stunde noch frisch ist.</h1>
		<p class="text-muted-foreground mt-4 max-w-md text-base">
			Stundenplan einmal anlegen, dann Aufgabe eintippen. Tab, Enter, fertig. Ohne Internet wartet alles in der Warteschlange, die Erinnerung kommt per E-Mail.
		</p>
	</div>

	<form class="bg-card space-y-4 rounded-3xl border p-6 shadow-sm" onsubmit={submit}>
		<div class="bg-muted grid grid-cols-2 rounded-2xl p-1 text-sm">
			<button type="button" class="rounded-xl px-3 py-2 {mode === 'login' ? 'bg-card shadow-xs' : ''}" onclick={() => (mode = 'login')}>
				Anmelden
			</button>
			<button type="button" class="rounded-xl px-3 py-2 {mode === 'register' ? 'bg-card shadow-xs' : ''}" onclick={() => (mode = 'register')}>
				Konto erstellen
			</button>
		</div>
		{#if mode === 'register'}
			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input id="name" bind:value={name} required placeholder="Henny" />
			</div>
		{/if}
		<div class="space-y-2">
			<Label for="email">E-Mail</Label>
			<Input id="email" type="email" bind:value={email} required placeholder="du@schule.de" />
		</div>
		<div class="space-y-2">
			<Label for="password">Passwort</Label>
			<Input id="password" type="password" bind:value={password} required minlength={8} placeholder="Mindestens 8 Zeichen" />
		</div>
		{#if error}
			<p class="text-destructive text-sm">{error}</p>
		{/if}
		<Button type="submit" class="w-full" disabled={pending}>
			<Mail class="size-4" />
			{pending ? 'Bitte warten…' : mode === 'login' ? 'Rein da' : 'Konto anlegen'}
		</Button>
	</form>
</div>
