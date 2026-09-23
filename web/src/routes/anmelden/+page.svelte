<script lang="ts">
	import { goto } from '$app/navigation';
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
					? 'Diese E-Mail gibt es schon.'
					: message;
		} finally {
			pending = false;
		}
	}
</script>

<div class="mx-auto grid min-h-screen max-w-4xl items-center gap-12 px-6 py-12 md:grid-cols-2">
	<div class="hidden md:block">
		<p class="text-xs font-semibold tracking-widest uppercase">Hausi</p>
		<h1 class="mt-3 text-4xl font-semibold tracking-tight">Stundenplan, Aufgabe, fertig.</h1>
		<p class="text-muted-foreground mt-3 max-w-sm text-sm leading-6">
			Einmal den Plan setzen. Danach Strg+Alt+H, Titel, Enter. Die nächste Stunde hängt automatisch an, wenn du gerade in einer bist.
		</p>
	</div>
	<form class="mx-auto w-full max-w-sm space-y-4" onsubmit={submit}>
		<div class="md:hidden">
			<p class="text-xs font-semibold tracking-widest uppercase">Hausi</p>
			<h1 class="mt-2 text-2xl font-semibold tracking-tight">{mode === 'login' ? 'Anmelden' : 'Konto'}</h1>
		</div>
		<div class="bg-muted flex rounded-md p-1 text-sm">
			<button type="button" class="flex-1 rounded-sm py-1.5 {mode === 'login' ? 'bg-background' : 'text-muted-foreground'}" onclick={() => (mode = 'login')}>
				Login
			</button>
			<button type="button" class="flex-1 rounded-sm py-1.5 {mode === 'register' ? 'bg-background' : 'text-muted-foreground'}" onclick={() => (mode = 'register')}>
				Konto
			</button>
		</div>
		{#if mode === 'register'}
			<div class="space-y-1.5">
				<Label for="name">Name</Label>
				<Input id="name" bind:value={name} required placeholder="Vorname" autocomplete="name" />
			</div>
		{/if}
		<div class="space-y-1.5">
			<Label for="email">E-Mail</Label>
			<Input id="email" type="email" bind:value={email} required placeholder="du@schule.de" autocomplete="email" />
		</div>
		<div class="space-y-1.5">
			<Label for="password">Passwort</Label>
			<Input id="password" type="password" bind:value={password} required minlength={8} placeholder="Mindestens 8 Zeichen" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} />
		</div>
		{#if error}
			<p class="text-destructive text-sm">{error}</p>
		{/if}
		<Button type="submit" class="w-full" disabled={pending}>{pending ? 'Einen Moment…' : mode === 'login' ? 'Rein' : 'Konto anlegen'}</Button>
	</form>
</div>
