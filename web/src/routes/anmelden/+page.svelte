<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { goto } from '$app/navigation';
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
		if (!hausi.online) {
			error = 'Für die erste Anmeldung brauchst du Internet.';
			return;
		}
		pending = true;
		try {
			if (mode === 'register') await hausi.register(name.trim(), email.trim(), password);
			else await hausi.login(email.trim(), password);
			goto('/app');
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : '';
			error = message.includes('Invalid credentials')
				? 'E-Mail oder Passwort stimmt nicht.'
				: message.includes('already')
					? 'Diese E-Mail gibt es schon.'
					: message.includes('fetch') || !message
						? 'Keine Verbindung zum Server.'
						: message;
		} finally {
			pending = false;
		}
	}

	const steps = [
		{ keys: ['Strg', 'Alt', 'H'], text: 'Von überall öffnen' },
		{ keys: ['Titel'], text: 'Aufgabe eintippen' },
		{ keys: ['Enter'], text: 'Fach hängt automatisch dran' }
	];
</script>

<div class="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
	<aside class="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
		<div class="pointer-events-none absolute -bottom-40 -left-32 size-[520px] rounded-full border border-current opacity-[0.07]"></div>
		<div class="pointer-events-none absolute -bottom-24 -left-16 size-[360px] rounded-full border border-current opacity-[0.07]"></div>
		<div class="flex items-center gap-2.5">
			<span class="bg-primary-foreground text-primary grid size-9 place-items-center rounded-xl text-base font-bold">H</span>
			<span class="text-lg font-semibold tracking-tight">Hausi</span>
		</div>
		<div class="relative">
			<h1 class="max-w-md text-5xl leading-[1.05] font-semibold tracking-[-0.035em]">Hausaufgaben in drei Tasten.</h1>
			<p class="mt-5 max-w-sm text-[15px] leading-7 opacity-65">
				Einmal den Stundenplan anlegen. Danach landet jede Aufgabe beim richtigen Fach und erinnert dich zur nächsten Stunde.
			</p>
			<ol class="mt-10 space-y-3">
				{#each steps as step, index}
					<li class="flex items-center gap-4">
						<span class="tabular w-5 text-sm opacity-40">{index + 1}</span>
						<span class="flex gap-1">
							{#each step.keys as key}
								<span class="inline-flex h-7 items-center rounded-md border border-current/20 bg-current/5 px-2.5 text-xs font-medium">{key}</span>
							{/each}
						</span>
						<span class="text-sm opacity-65">{step.text}</span>
					</li>
				{/each}
			</ol>
		</div>
		<p class="relative text-xs opacity-45">Funktioniert nach der ersten Anmeldung auch offline.</p>
	</aside>

	<main class="flex items-center justify-center px-6 py-12">
		<form class="rise w-full max-w-sm" onsubmit={submit}>
			<div class="mb-8 flex items-center gap-2.5 lg:hidden">
				<span class="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl text-base font-bold">H</span>
				<span class="text-lg font-semibold tracking-tight">Hausi</span>
			</div>
			<h2 class="text-[28px] font-semibold tracking-[-0.02em]">{mode === 'login' ? 'Willkommen zurück' : 'Konto anlegen'}</h2>
			<p class="text-muted-foreground mt-1.5 text-sm">
				{mode === 'login' ? 'Melde dich an, um weiterzumachen.' : 'Kostenlos, in einer Minute fertig.'}
			</p>

			{#if !hausi.online}
				<div class="bg-muted mt-6 flex items-start gap-2.5 rounded-xl p-3 text-sm">
					<WifiOff class="mt-0.5 size-4 shrink-0" />
					<span>Du bist offline. Für die erste Anmeldung brauchst du Internet, danach geht alles auch ohne.</span>
				</div>
			{/if}

			<div class="seg mt-6 grid w-full grid-cols-2">
				<button type="button" aria-pressed={mode === 'login'} onclick={() => (mode = 'login')}>Anmelden</button>
				<button type="button" aria-pressed={mode === 'register'} onclick={() => (mode = 'register')}>Registrieren</button>
			</div>

			<div class="mt-5 space-y-3.5">
				{#if mode === 'register'}
					<label class="block">
						<span class="mb-1.5 block text-[13px] font-medium">Name</span>
						<input class="field h-11" bind:value={name} required placeholder="Vorname" autocomplete="name" />
					</label>
				{/if}
				<label class="block">
					<span class="mb-1.5 block text-[13px] font-medium">E-Mail</span>
					<input class="field h-11" type="email" bind:value={email} required placeholder="du@schule.de" autocomplete="email" />
				</label>
				<label class="block">
					<span class="mb-1.5 block text-[13px] font-medium">Passwort</span>
					<input
						class="field h-11"
						type="password"
						bind:value={password}
						required
						minlength={8}
						placeholder="Mindestens 8 Zeichen"
						autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					/>
				</label>
			</div>

			{#if error}
				<p class="bg-muted mt-4 rounded-lg px-3 py-2 text-sm">{error}</p>
			{/if}

			<button type="submit" class="btn btn-primary mt-6 h-11 w-full" disabled={pending}>
				{pending ? 'Einen Moment …' : mode === 'login' ? 'Anmelden' : 'Konto anlegen'}
				{#if !pending}<ArrowRight class="size-4" />{/if}
			</button>
		</form>
	</main>
</div>
