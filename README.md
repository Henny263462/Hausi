# Hausi

Hausaufgaben mit Stundenplan. Die Web-App liegt in `web` (SvelteKit), die Windows-App in `desktop` (Electron). Daten liegen im Appwrite-Projekt Hauso.

## Starten

```bash
npm install --prefix web
npm run dev
```

Die Seite läuft auf http://localhost:5180.

Desktop-Fenster, während die Web-App läuft:

```bash
npm install --prefix desktop
npm run desktop
```

`Strg+Alt+H` öffnet die Erfassung ohne Fensterrand.

## Erinnerungen

Die Function `reminders` schickt fällige Aufgaben per E-Mail und löscht abgelaufene Aufgaben. Dafür braucht das Projekt unter Messaging einen aktiven E-Mail-Provider.
