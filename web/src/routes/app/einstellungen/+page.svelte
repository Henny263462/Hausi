<script lang="ts">
	import { goto } from '$app/navigation';
	import Bell from '@lucide/svelte/icons/bell';
	import Crown from '@lucide/svelte/icons/crown';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { Button } from '$lib/components/ui/button';
	import { hausi } from '$lib/store.svelte';
</script>

<div class="max-w-xl space-y-4 pb-24">
	<h1 class="font-serif text-4xl">Einstellungen</h1>
	<section class="bg-card space-y-3 rounded-3xl border p-5">
		<p class="text-sm font-medium">{hausi.user?.name}</p>
		<p class="text-muted-foreground text-sm">{hausi.user?.email}</p>
		<Button
			variant="outline"
			onclick={async () => {
				await hausi.logout();
				goto('/anmelden');
			}}
		>
			<LogOut class="size-4" /> Abmelden
		</Button>
	</section>

	<section class="bg-card space-y-3 rounded-3xl border p-5">
		<p class="flex items-center gap-2 font-medium"><Crown class="size-4" /> Premium</p>
		<p class="text-muted-foreground text-sm">
			Ohne Premium löscht Hausi Aufgaben nach 2 Monaten, inklusive Anhängen. Notizen und der Stundenplan bleiben. Mit Premium bleiben Aufgaben erhalten.
		</p>
		<Button variant={hausi.profile?.premium ? 'default' : 'outline'} onclick={() => hausi.setPremium(!hausi.profile?.premium)}>
			{hausi.profile?.premium ? 'Premium ist an' : 'Premium einschalten'}
		</Button>
	</section>

	<section class="bg-card space-y-2 rounded-3xl border p-5 text-sm">
		<p class="flex items-center gap-2 font-medium"><Keyboard class="size-4" /> Schnellerfassung unter Windows</p>
		<p class="text-muted-foreground">Strg+Alt+H öffnet das Fenster ohne Rand.</p>
		<ol class="text-muted-foreground list-decimal space-y-1 pl-4">
			<li>Titel tippen. Tab wechselt zwischen Aufgabe und Notiz.</li>
			<li>Enter öffnet die Details.</li>
			<li>Enter, dann Tab: an ein Fach hängen oder nicht.</li>
			<li>Enter: Erinnerung an die nächste Stunde, nächste Woche oder ein eigenes Datum.</li>
			<li>Enter speichert. Ohne Internet landet es in der Warteschlange.</li>
		</ol>
	</section>

	<section class="bg-card space-y-2 rounded-3xl border p-5 text-sm">
		<p class="flex items-center gap-2 font-medium"><Bell class="size-4" /> E-Mail-Erinnerung</p>
		<p class="text-muted-foreground">
			Alle 15 Minuten prüft Appwrite fällige Aufgaben und schickt die Mail an deine Konto-Adresse. Dafür muss im Projekt Hauso unter Messaging ein E-Mail-Provider aktiv sein.
		</p>
	</section>
</div>
