import { ID, Permission, Query, Role } from 'appwrite';
import { account, Channel, functions, realtime, storage, tables, teams } from './appwrite';
import { BUCKET_ID, DATABASE_ID, FREE_RETENTION_DAYS, JOIN_BOOK_FN, TABLES } from './config';
import { clearQueue, enqueue, listQueue, queueCount, removeQueued, type QueueOp } from './queue';
import { parsePeriods } from './schedule';
import type { Book, CalEvent, Lesson, LocalFile, Note, Period, Profile, RemindMode, Share, Task, Timetable } from './types';

const CACHE_KEY = 'hausi-cache-v1';

type User = { $id: string; email: string; name: string };
type Toast = { id: string; text: string; tone: 'ok' | 'warn' };
type Draft = QueueOp extends infer T ? (T extends QueueOp ? Omit<T, 'id' | 'at'> : never) : never;

type Snapshot = {
	user: User;
	profile: Profile | null;
	timetables: Timetable[];
	lessons: Lesson[];
	tasks: Task[];
	notes: Note[];
	shares: Share[];
	books: Book[];
	events: CalEvent[];
	syncedAt: string | null;
};

function own(userId: string) {
	return [
		Permission.read(Role.user(userId)),
		Permission.update(Role.user(userId)),
		Permission.delete(Role.user(userId))
	];
}

function bookPerms(userId: string, book: Book | null | undefined) {
	if (!book?.teamId) return own(userId);
	return [
		...own(userId),
		Permission.read(Role.team(book.teamId)),
		Permission.update(Role.team(book.teamId)),
		Permission.delete(Role.team(book.teamId))
	];
}

function asString(value: unknown) {
	return typeof value === 'string' ? value : '';
}

function asBool(value: unknown) {
	return value === true;
}

function mapTask(row: Record<string, unknown>): Task {
	return {
		$id: asString(row.$id),
		$createdAt: asString(row.$createdAt),
		userId: asString(row.userId),
		bookId: asString(row.bookId),
		title: asString(row.title),
		details: asString(row.details),
		subject: asString(row.subject),
		lessonId: asString(row.lessonId),
		timetableId: asString(row.timetableId),
		done: asBool(row.done),
		remindMode: (asString(row.remindMode) || 'none') as RemindMode,
		remindAt: asString(row.remindAt) || null,
		reminderSent: asBool(row.reminderSent),
		expiresAt: asString(row.expiresAt) || null,
		fileIds: Array.isArray(row.fileIds) ? row.fileIds.map(String) : []
	};
}

function mapShare(row: Record<string, unknown>): Share {
	return {
		$id: asString(row.$id),
		userId: asString(row.userId),
		taskId: asString(row.taskId),
		kind: asString(row.kind) === 'note' ? 'note' : 'task',
		title: asString(row.title),
		details: asString(row.details),
		subject: asString(row.subject),
		fileIds: Array.isArray(row.fileIds) ? row.fileIds.map(String) : []
	};
}

function mapNote(row: Record<string, unknown>): Note {
	return {
		$id: asString(row.$id),
		$createdAt: asString(row.$createdAt),
		userId: asString(row.userId),
		bookId: asString(row.bookId),
		title: asString(row.title),
		body: asString(row.body),
		subject: asString(row.subject)
	};
}

function mapBook(row: Record<string, unknown>): Book {
	return {
		$id: asString(row.$id),
		userId: asString(row.userId),
		name: asString(row.name),
		kind: asString(row.kind) === 'shared' ? 'shared' : 'private',
		teamId: asString(row.teamId),
		inviteCode: asString(row.inviteCode)
	};
}

function mapEvent(row: Record<string, unknown>): CalEvent {
	return {
		$id: asString(row.$id),
		userId: asString(row.userId),
		bookId: asString(row.bookId),
		title: asString(row.title),
		details: asString(row.details),
		subject: asString(row.subject),
		startsAt: asString(row.startsAt),
		kind: asString(row.kind) === 'event' ? 'event' : 'exam'
	};
}

function mapTimetable(row: Record<string, unknown>): Timetable {
	return {
		$id: asString(row.$id),
		userId: asString(row.userId),
		name: asString(row.name),
		active: asBool(row.active),
		periods: parsePeriods(row.periods)
	};
}

function mapLesson(row: Record<string, unknown>): Lesson {
	return {
		$id: asString(row.$id),
		userId: asString(row.userId),
		timetableId: asString(row.timetableId),
		subject: asString(row.subject),
		weekday: Number(row.weekday),
		startMin: Number(row.startMin),
		endMin: Number(row.endMin),
		room: asString(row.room),
		color: asString(row.color)
	};
}

function keepPending<T extends { $id: string; pending?: boolean }>(server: T[], local: T[]) {
	const ids = new Set(server.map((item) => item.$id));
	return [...local.filter((item) => item.pending && !ids.has(item.$id)), ...server];
}

function mergeById<T extends { $id: string }>(...lists: T[][]) {
	const map = new Map<string, T>();
	for (const list of lists) for (const item of list) map.set(item.$id, item);
	return [...map.values()];
}

function freshExpiry(premium: boolean, from = new Date()) {
	if (premium) return null;
	const date = new Date(from);
	date.setDate(date.getDate() + FREE_RETENTION_DAYS);
	return date.toISOString();
}

function isOnline() {
	return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function errorCode(error: unknown) {
	const code = (error as { code?: unknown } | null)?.code;
	return typeof code === 'number' ? code : 0;
}

function errorMessage(error: unknown) {
	const message = (error as { message?: unknown } | null)?.message;
	return typeof message === 'string' && message.trim() ? message : '';
}

function isAuthError(error: unknown) {
	return errorCode(error) === 401;
}

function isNetworkError(error: unknown) {
	const code = errorCode(error);
	return !isOnline() || code === 0 || code >= 500;
}

function inviteCode() {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	let value = '';
	for (let i = 0; i < 8; i++) value += alphabet[Math.floor(Math.random() * alphabet.length)];
	return value;
}

function toUploadFile(file: Blob, name = 'anhang') {
	const fileName = (file instanceof File && file.name) || name;
	return new File([file], fileName, {
		type: file.type || 'application/octet-stream',
		lastModified: file instanceof File ? file.lastModified : Date.now()
	});
}

function fileFromLocal(file: LocalFile) {
	return new File([new Uint8Array(file.buffer)], file.name || 'anhang', {
		type: file.type || 'application/octet-stream'
	});
}

function readCache(): Snapshot | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Snapshot;
		return parsed?.user?.$id ? parsed : null;
	} catch {
		return null;
	}
}

class HausiStore {
	user = $state<User | null>(null);
	ready = $state(false);
	online = $state(true);
	syncing = $state(false);
	syncedAt = $state<string | null>(null);
	profile = $state<Profile | null>(null);
	timetables = $state<Timetable[]>([]);
	lessons = $state<Lesson[]>([]);
	tasks = $state<Task[]>([]);
	notes = $state<Note[]>([]);
	shares = $state<Share[]>([]);
	books = $state<Book[]>([]);
	events = $state<CalEvent[]>([]);
	queued = $state(0);
	toasts = $state<Toast[]>([]);
	captureOpen = $state(false);
	private flushing = false;
	private started = false;
	private verified = false;
	private lastCache = '';
	private live: { unsubscribe: () => Promise<void> } | null = null;
	private liveTimer: ReturnType<typeof setTimeout> | undefined;

	get activeTimetable() {
		return (
			this.timetables.find((item) => item.$id === this.profile?.activeTimetableId) ??
			this.timetables.find((item) => item.active) ??
			this.timetables[0] ??
			null
		);
	}

	get privateBook() {
		const userId = this.user?.$id;
		return this.books.find((book) => book.kind === 'private' && book.userId === userId) ?? this.books.find((book) => book.kind === 'private') ?? null;
	}

	get activeBook() {
		return this.books.find((book) => book.$id === this.profile?.activeBookId) ?? this.privateBook;
	}

	get inSharedBook() {
		return this.activeBook?.kind === 'shared';
	}

	get bookTasks() {
		const book = this.activeBook;
		if (!book) return this.tasks;
		return this.tasks.filter((task) => task.bookId === book.$id || (!task.bookId && book.kind === 'private'));
	}

	get bookNotes() {
		const book = this.activeBook;
		if (!book) return this.notes;
		return this.notes.filter((note) => note.bookId === book.$id || (!note.bookId && book.kind === 'private'));
	}

	get bookEvents() {
		const id = this.activeBook?.$id;
		return id ? this.events.filter((item) => item.bookId === id) : this.events;
	}

	get activeLessons() {
		const id = this.activeTimetable?.$id;
		return id ? this.lessons.filter((lesson) => lesson.timetableId === id) : [];
	}

	get subjects() {
		return [...new Set(this.activeLessons.map((lesson) => lesson.subject))].sort((a, b) => a.localeCompare(b, 'de'));
	}

	get hasSchedule() {
		return this.lessons.length > 0;
	}

	get openTasks() {
		return this.bookTasks.filter((task) => !task.done && !this.isExpired(task));
	}

	constructor() {
		if (typeof window === 'undefined') return;
		this.online = navigator.onLine;
		window.addEventListener('online', () => {
			this.online = true;
			void this.reconnect();
		});
		window.addEventListener('offline', () => {
			this.online = false;
		});
		window.addEventListener('storage', (event) => {
			if (event.key !== CACHE_KEY) return;
			if (!event.newValue) {
				this.clearData();
				return;
			}
			this.lastCache = event.newValue;
			try {
				const snapshot = JSON.parse(event.newValue) as Snapshot;
				if (!this.user || snapshot.user.$id === this.user.$id) this.apply(snapshot);
			} catch {
				/* fremder Cache */
			}
			void queueCount().then((count) => (this.queued = count));
		});
		$effect.root(() => {
			$effect(() => this.persist());
		});
	}

	ping(text: string, tone: 'ok' | 'warn' = 'ok') {
		const id = crypto.randomUUID();
		this.toasts = [...this.toasts.slice(-3), { id, text, tone }];
		setTimeout(() => {
			this.toasts = this.toasts.filter((item) => item.id !== id);
		}, 3400);
	}

	isExpired(task: Task) {
		return !!task.expiresAt && new Date(task.expiresAt).getTime() < Date.now();
	}

	private persist() {
		if (!this.user) return;
		const snapshot: Snapshot = {
			user: this.user,
			profile: this.profile,
			timetables: this.timetables,
			lessons: this.lessons,
			tasks: this.tasks,
			notes: this.notes,
			shares: this.shares,
			books: this.books,
			events: this.events,
			syncedAt: this.syncedAt
		};
		const text = JSON.stringify(snapshot);
		if (text === this.lastCache) return;
		this.lastCache = text;
		try {
			localStorage.setItem(CACHE_KEY, text);
		} catch {
			/* Speicher voll */
		}
	}

	private apply(snapshot: Snapshot) {
		this.user = snapshot.user;
		this.profile = snapshot.profile;
		this.timetables = snapshot.timetables ?? [];
		this.lessons = snapshot.lessons ?? [];
		this.tasks = snapshot.tasks ?? [];
		this.notes = snapshot.notes ?? [];
		this.shares = snapshot.shares ?? [];
		this.books = snapshot.books ?? [];
		this.events = snapshot.events ?? [];
		this.syncedAt = snapshot.syncedAt ?? null;
	}

	private clearData() {
		this.user = null;
		this.profile = null;
		this.timetables = [];
		this.lessons = [];
		this.tasks = [];
		this.notes = [];
		this.shares = [];
		this.books = [];
		this.events = [];
		this.syncedAt = null;
	}

	private async listen() {
		await this.live?.unsubscribe().catch(() => undefined);
		try {
			this.live = await realtime.subscribe(
				[
					Channel.tablesdb(DATABASE_ID).table(TABLES.tasks).row(),
					Channel.tablesdb(DATABASE_ID).table(TABLES.notes).row(),
					Channel.tablesdb(DATABASE_ID).table(TABLES.lessons).row(),
					Channel.tablesdb(DATABASE_ID).table(TABLES.timetables).row(),
					Channel.tablesdb(DATABASE_ID).table(TABLES.shares).row(),
					Channel.tablesdb(DATABASE_ID).table(TABLES.books).row(),
					Channel.tablesdb(DATABASE_ID).table(TABLES.events).row()
				],
				() => {
					clearTimeout(this.liveTimer);
					this.liveTimer = setTimeout(() => void this.refresh(), 150);
				}
			);
		} catch {
			this.live = null;
		}
	}

	async init() {
		if (this.started) return;
		this.started = true;
		const cached = readCache();
		if (cached) {
			this.apply(cached);
			this.lastCache = localStorage.getItem(CACHE_KEY) ?? '';
			this.ready = true;
		}
		this.queued = await queueCount().catch(() => 0);
		try {
			const user = await account.get();
			if (cached && cached.user.$id !== user.$id) this.clearData();
			this.user = { $id: user.$id, email: user.email, name: user.name };
			this.verified = true;
			await this.sync();
		} catch (error) {
			if (isAuthError(error)) await this.forget();
		} finally {
			this.ready = true;
		}
	}

	private async sync() {
		await this.flush();
		await this.refresh();
		await this.listen();
	}

	private async reconnect() {
		if (!this.user) return;
		if (!this.verified) {
			try {
				await account.get();
				this.verified = true;
			} catch (error) {
				if (isAuthError(error)) {
					await this.forget();
					this.ping('Bitte neu anmelden.', 'warn');
				}
				return;
			}
		}
		await this.sync();
	}

	async syncNow() {
		if (!isOnline()) {
			this.ping('Du bist offline. Änderungen warten lokal.', 'warn');
			return;
		}
		await this.reconnect();
		this.ping(this.queued ? `${this.queued} Änderungen warten noch.` : 'Alles synchronisiert.');
	}

	async refresh() {
		if (!this.user || !isOnline()) return false;
		if (this.queued > 0) {
			await this.flush();
			if (this.queued > 0) return false;
		}
		const userId = this.user.$id;
		this.syncing = true;
		try {
			const [profiles, timetables, lessons, ownTasks, notesOwn, shares, books] = await Promise.all([
				tables.listRows({
					databaseId: DATABASE_ID,
					tableId: TABLES.profiles,
					queries: [Query.equal('userId', userId), Query.limit(1)]
				}),
				tables.listRows({
					databaseId: DATABASE_ID,
					tableId: TABLES.timetables,
					queries: [Query.equal('userId', userId), Query.limit(50)]
				}),
				tables.listRows({
					databaseId: DATABASE_ID,
					tableId: TABLES.lessons,
					queries: [Query.equal('userId', userId), Query.limit(400)]
				}),
				tables.listRows({
					databaseId: DATABASE_ID,
					tableId: TABLES.tasks,
					queries: [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(200)]
				}),
				tables.listRows({
					databaseId: DATABASE_ID,
					tableId: TABLES.notes,
					queries: [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(200)]
				}),
				tables.listRows({
					databaseId: DATABASE_ID,
					tableId: TABLES.shares,
					queries: [Query.equal('userId', userId), Query.limit(200)]
				}),
				tables.listRows({
					databaseId: DATABASE_ID,
					tableId: TABLES.books,
					queries: [Query.limit(50)]
				})
			]);

			this.books = (books.rows as Record<string, unknown>[]).map(mapBook);
			const bookIds = this.books.map((book) => book.$id);
			const [bookTasks, bookNotes, bookEvents] = bookIds.length
				? await Promise.all([
						tables.listRows({
							databaseId: DATABASE_ID,
							tableId: TABLES.tasks,
							queries: [Query.equal('bookId', bookIds), Query.orderDesc('$createdAt'), Query.limit(200)]
						}),
						tables.listRows({
							databaseId: DATABASE_ID,
							tableId: TABLES.notes,
							queries: [Query.equal('bookId', bookIds), Query.orderDesc('$createdAt'), Query.limit(200)]
						}),
						tables.listRows({
							databaseId: DATABASE_ID,
							tableId: TABLES.events,
							queries: [Query.equal('bookId', bookIds), Query.orderAsc('startsAt'), Query.limit(200)]
						})
					])
				: [{ rows: [] }, { rows: [] }, { rows: [] }];

			const profileRow = profiles.rows[0] as Record<string, unknown> | undefined;
			if (!profileRow) {
				const created = await tables.createRow({
					databaseId: DATABASE_ID,
					tableId: TABLES.profiles,
					rowId: ID.unique(),
					data: { userId, name: this.user.name, premium: false, activeTimetableId: '', activeBookId: '' },
					permissions: own(userId)
				});
				this.profile = {
					$id: created.$id,
					userId,
					name: this.user.name,
					premium: false,
					activeTimetableId: '',
					activeBookId: ''
				};
			} else {
				this.profile = {
					$id: asString(profileRow.$id),
					userId,
					name: asString(profileRow.name) || this.user.name,
					premium: asBool(profileRow.premium),
					activeTimetableId: asString(profileRow.activeTimetableId),
					activeBookId: asString(profileRow.activeBookId)
				};
			}

			this.timetables = (timetables.rows as Record<string, unknown>[]).map(mapTimetable);
			this.lessons = (lessons.rows as Record<string, unknown>[]).map(mapLesson);
			const serverTasks = mergeById(
				(ownTasks.rows as Record<string, unknown>[]).map(mapTask),
				(bookTasks.rows as Record<string, unknown>[]).map(mapTask)
			).filter((task) => !this.isExpired(task));
			this.tasks = keepPending(serverTasks, this.tasks);
			this.notes = keepPending(
				mergeById((notesOwn.rows as Record<string, unknown>[]).map(mapNote), (bookNotes.rows as Record<string, unknown>[]).map(mapNote)),
				this.notes
			);
			this.events = keepPending((bookEvents.rows as Record<string, unknown>[]).map(mapEvent), this.events);
			this.shares = (shares.rows as Record<string, unknown>[]).map(mapShare);
			await this.ensureBooks();
			this.syncedAt = new Date().toISOString();
			return true;
		} catch (error) {
			if (isAuthError(error)) await this.forget();
			return false;
		} finally {
			this.syncing = false;
		}
	}

	private async ensureBooks() {
		if (!this.user || !this.profile) return;
		const userId = this.user.$id;
		if (!this.privateBook) {
			const rowId = ID.unique();
			const book: Book = { $id: rowId, userId, name: 'Privates Buch', kind: 'private', teamId: '', inviteCode: '' };
			await tables.createRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.books,
				rowId,
				data: { userId, name: book.name, kind: 'private', teamId: '', inviteCode: '' },
				permissions: own(userId)
			});
			this.books = [book, ...this.books];
		}
		const privateId = this.privateBook?.$id;
		if (privateId) {
			for (const task of this.tasks.filter((item) => !item.bookId && item.userId === userId)) {
				this.patchTask(task.$id, { bookId: privateId });
				await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: task.$id, data: { bookId: privateId } }).catch(() => undefined);
			}
			for (const note of this.notes.filter((item) => !item.bookId && item.userId === userId)) {
				this.patchNote(note.$id, { bookId: privateId });
				await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.notes, rowId: note.$id, data: { bookId: privateId } }).catch(() => undefined);
			}
		}
		const active = this.books.find((book) => book.$id === this.profile?.activeBookId);
		if (!active && this.privateBook) await this.setActiveBook(this.privateBook.$id);
	}

	async register(name: string, email: string, password: string) {
		await account.create({ userId: ID.unique(), email, password, name });
		await this.login(email, password);
	}

	async login(email: string, password: string) {
		await account.createEmailPasswordSession({ email, password });
		const user = await account.get();
		const cached = readCache();
		if (cached && cached.user.$id !== user.$id) {
			localStorage.removeItem(CACHE_KEY);
			await clearQueue();
			this.queued = 0;
		}
		this.user = { $id: user.$id, email: user.email, name: user.name };
		this.verified = true;
		await this.sync();
	}

	private async forget() {
		await this.live?.unsubscribe().catch(() => undefined);
		this.live = null;
		this.verified = false;
		this.clearData();
		this.lastCache = '';
		localStorage.removeItem(CACHE_KEY);
		await clearQueue().catch(() => undefined);
		this.queued = 0;
	}

	async logout() {
		try {
			await account.deleteSession({ sessionId: 'current' });
		} catch {
			/* offline abgemeldet */
		}
		await this.forget();
	}

	private async send(draft: Draft) {
		const op = { ...draft, id: crypto.randomUUID(), at: Date.now() } as QueueOp;
		if (!isOnline() || this.queued > 0) {
			await this.park(op);
			if (isOnline()) void this.flush();
			return false;
		}
		try {
			await this.runOp(op);
			return true;
		} catch (error) {
			if (!isNetworkError(error)) throw error;
			await this.park(op);
			return false;
		}
	}

	private async park(op: QueueOp) {
		await enqueue(op);
		this.queued = await queueCount();
	}

	private async attempt(work: () => Promise<unknown>) {
		try {
			await work();
		} catch (error) {
			this.ping(errorMessage(error) || 'Das hat nicht geklappt. Bitte nochmal versuchen.', 'warn');
			void this.refresh();
		}
	}

	private needsInternet() {
		if (isOnline()) return false;
		this.ping('Dafür brauchst du Internet.', 'warn');
		return true;
	}

	private patchTask(id: string, data: Partial<Task>) {
		this.tasks = this.tasks.map((item) => (item.$id === id ? { ...item, ...data } : item));
	}

	private patchNote(id: string, data: Partial<Note>) {
		this.notes = this.notes.map((item) => (item.$id === id ? { ...item, ...data } : item));
	}

	async setPremium(premium: boolean) {
		if (!this.user || !this.profile) return;
		const profileId = this.profile.$id;
		this.profile = { ...this.profile, premium };
		await this.attempt(async () => {
			await this.send({ kind: 'update', table: TABLES.profiles, rowId: profileId, data: { premium } });
			for (const task of this.tasks) {
				const expiresAt = premium ? null : freshExpiry(false, new Date(task.$createdAt || Date.now()));
				this.patchTask(task.$id, { expiresAt });
				await this.send({ kind: 'update', table: TABLES.tasks, rowId: task.$id, data: { expiresAt } });
			}
		});
		this.ping(premium ? 'Premium ist an. Aufgaben bleiben erhalten.' : 'Kostenlos: Aufgaben bleiben 2 Monate.');
	}

	private async setActiveTimetableId(id: string) {
		if (!this.profile) return;
		const profileId = this.profile.$id;
		this.profile = { ...this.profile, activeTimetableId: id };
		await this.send({ kind: 'update', table: TABLES.profiles, rowId: profileId, data: { activeTimetableId: id } });
	}

	async setActiveBook(id: string) {
		if (!this.profile) return;
		const profileId = this.profile.$id;
		this.profile = { ...this.profile, activeBookId: id };
		await this.send({ kind: 'update', table: TABLES.profiles, rowId: profileId, data: { activeBookId: id } });
	}

	async createSharedBook(name: string) {
		if (!this.user || this.needsInternet()) return;
		const userId = this.user.$id;
		const teamId = ID.unique();
		const rowId = ID.unique();
		const code = inviteCode();
		const label = name.trim() || 'Geteiltes Buch';
		await teams.create({ teamId, name: label, roles: ['owner'] });
		const book: Book = { $id: rowId, userId, name: label, kind: 'shared', teamId, inviteCode: code };
		await tables.createRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.books,
			rowId,
			data: { userId, name: label, kind: 'shared', teamId, inviteCode: code },
			permissions: [
				Permission.read(Role.team(teamId)),
				Permission.update(Role.team(teamId)),
				Permission.delete(Role.user(userId))
			]
		});
		this.books = [...this.books, book];
		await this.setActiveBook(rowId);
		this.ping('Geteiltes Buch erstellt.');
		return book;
	}

	async renameBook(id: string, name: string) {
		this.books = this.books.map((book) => (book.$id === id ? { ...book, name } : book));
		await this.attempt(() => this.send({ kind: 'update', table: TABLES.books, rowId: id, data: { name } }));
	}

	async joinBook(code: string) {
		if (!this.user || this.needsInternet()) return '';
		const execution = await functions.createExecution({
			functionId: JOIN_BOOK_FN,
			body: JSON.stringify({ code: code.trim() })
		});
		let payload: { bookId?: string; name?: string; message?: string } = {};
		try {
			payload = JSON.parse(execution.responseBody || '{}') as typeof payload;
		} catch {
			payload = {};
		}
		if (execution.responseStatusCode >= 400) {
			throw new Error(payload.message || 'Beitreten hat nicht geklappt.');
		}
		await this.refresh();
		if (payload.bookId) await this.setActiveBook(payload.bookId);
		this.ping(payload.name ? `Du bist in „${payload.name}“.` : 'Buch beigetreten.');
		return payload.bookId ?? '';
	}

	async leaveBook(book: Book) {
		if (!this.user || book.kind !== 'shared' || this.needsInternet()) return;
		if (book.userId === this.user.$id) {
			this.ping('Als Besitzer kannst du das Buch nur löschen.', 'warn');
			return;
		}
		const members = await teams.listMemberships({ teamId: book.teamId, queries: [Query.equal('userId', this.user.$id), Query.limit(5)] });
		for (const member of members.memberships) {
			await teams.deleteMembership({ teamId: book.teamId, membershipId: member.$id });
		}
		this.books = this.books.filter((item) => item.$id !== book.$id);
		if (this.privateBook) await this.setActiveBook(this.privateBook.$id);
		this.ping('Du hast das Buch verlassen.');
	}

	async deleteBook(book: Book) {
		if (!this.user || book.kind !== 'shared' || book.userId !== this.user.$id || this.needsInternet()) return;
		await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.books, rowId: book.$id });
		try {
			await teams.delete({ teamId: book.teamId });
		} catch {
			/* Team kann schon weg sein */
		}
		this.books = this.books.filter((item) => item.$id !== book.$id);
		if (this.privateBook) await this.setActiveBook(this.privateBook.$id);
		this.ping('Buch gelöscht.');
	}

	bookLink(book: Book) {
		const origin =
			typeof location === 'undefined' || location.hostname === '127.0.0.1' || location.hostname === 'localhost'
				? 'https://hausi.appwrite.network'
				: location.origin;
		return `${origin}/buch/${book.inviteCode}`;
	}

	async createTimetable(name: string) {
		if (!this.user) return;
		const userId = this.user.$id;
		const rowId = ID.unique();
		const active = this.timetables.length === 0;
		this.timetables = [...this.timetables, { $id: rowId, userId, name, active, periods: [] }];
		await this.attempt(async () => {
			await this.send({
				kind: 'create',
				table: TABLES.timetables,
				rowId,
				data: { userId, name, active, periods: '[]' }
			});
			if (active) await this.setActiveTimetableId(rowId);
		});
	}

	async renameTimetable(id: string, name: string) {
		this.timetables = this.timetables.map((item) => (item.$id === id ? { ...item, name } : item));
		await this.attempt(() => this.send({ kind: 'update', table: TABLES.timetables, rowId: id, data: { name } }));
	}

	async savePeriods(id: string, periods: Period[]) {
		this.timetables = this.timetables.map((item) => (item.$id === id ? { ...item, periods } : item));
		await this.attempt(() =>
			this.send({ kind: 'update', table: TABLES.timetables, rowId: id, data: { periods: JSON.stringify(periods) } })
		);
	}

	async activateTimetable(id: string) {
		this.timetables = this.timetables.map((item) => ({ ...item, active: item.$id === id }));
		await this.attempt(async () => {
			for (const item of this.timetables) {
				await this.send({ kind: 'update', table: TABLES.timetables, rowId: item.$id, data: { active: item.$id === id } });
			}
			await this.setActiveTimetableId(id);
		});
	}

	async deleteTimetable(id: string) {
		this.lessons = this.lessons.filter((lesson) => lesson.timetableId !== id);
		this.timetables = this.timetables.filter((item) => item.$id !== id);
		const next = this.timetables[0];
		await this.attempt(async () => {
			await this.send({ kind: 'delete', table: TABLES.timetables, rowId: id });
			if (next) await this.activateTimetable(next.$id);
		});
	}

	async addLesson(input: Omit<Lesson, '$id' | 'userId'>) {
		if (!this.user) return;
		const userId = this.user.$id;
		const rowId = ID.unique();
		this.lessons = [...this.lessons, { ...input, $id: rowId, userId }];
		await this.attempt(() =>
			this.send({ kind: 'create', table: TABLES.lessons, rowId, data: { ...input, userId } })
		);
	}

	async deleteLesson(id: string) {
		this.lessons = this.lessons.filter((lesson) => lesson.$id !== id);
		await this.attempt(() => this.send({ kind: 'delete', table: TABLES.lessons, rowId: id }));
	}

	async createTask(input: {
		title: string;
		details: string;
		subject: string;
		lessonId: string;
		remindMode: RemindMode;
		remindAt: string | null;
		files: File[];
	}) {
		if (!this.user || !this.profile) return;
		const book = this.activeBook;
		const rowId = ID.unique();
		const expiresAt = freshExpiry(this.profile.premium);
		const payload: Record<string, unknown> = {
			userId: this.user.$id,
			bookId: book?.$id ?? '',
			title: input.title,
			details: input.details,
			subject: input.subject,
			lessonId: input.lessonId,
			timetableId: this.activeTimetable?.$id ?? '',
			done: false,
			remindMode: input.remindAt ? input.remindMode : 'none',
			remindAt: input.remindAt,
			reminderSent: false,
			expiresAt
		};
		this.tasks = [
			{
				$id: rowId,
				$createdAt: new Date().toISOString(),
				userId: this.user.$id,
				bookId: book?.$id ?? '',
				title: input.title,
				details: input.details,
				subject: input.subject,
				lessonId: input.lessonId,
				timetableId: this.activeTimetable?.$id ?? '',
				done: false,
				remindMode: input.remindAt ? input.remindMode : 'none',
				remindAt: input.remindAt,
				reminderSent: false,
				expiresAt,
				fileIds: [],
				pending: true
			},
			...this.tasks
		];

		try {
			const files = await filesFrom(input.files);
			const sent = await this.send({
				kind: 'task',
				rowId,
				payload,
				files,
				permissions: bookPerms(this.user.$id, book)
			});
			if (sent) {
				this.patchTask(rowId, { pending: false });
				if (files.length) void this.refresh();
				this.ping('Aufgabe gespeichert.');
			} else {
				this.ping('Offline gespeichert. Wird später synchronisiert.', 'warn');
			}
		} catch (error) {
			this.tasks = this.tasks.filter((task) => task.$id !== rowId);
			this.ping(errorMessage(error) || 'Die Aufgabe konnte nicht gespeichert werden.', 'warn');
		}
	}

	async createNote(input: { title: string; body: string; subject: string }) {
		if (!this.user) return;
		const book = this.activeBook;
		const rowId = ID.unique();
		const data = { userId: this.user.$id, bookId: book?.$id ?? '', title: input.title, body: input.body, subject: input.subject };
		this.notes = [{ $id: rowId, $createdAt: new Date().toISOString(), ...data, pending: true }, ...this.notes];
		try {
			const sent = await this.send({
				kind: 'create',
				table: TABLES.notes,
				rowId,
				data,
				permissions: bookPerms(this.user.$id, book)
			});
			if (sent) {
				this.patchNote(rowId, { pending: false });
				this.ping('Notiz gespeichert.');
			} else {
				this.ping('Offline gespeichert. Wird später synchronisiert.', 'warn');
			}
		} catch (error) {
			this.notes = this.notes.filter((note) => note.$id !== rowId);
			this.ping(errorMessage(error) || 'Die Notiz konnte nicht gespeichert werden.', 'warn');
		}
	}

	async createEvent(input: { title: string; details: string; subject: string; startsAt: string; kind: 'exam' | 'event' }) {
		if (!this.user) return;
		const book = this.activeBook;
		if (!book) {
			this.ping('Kein Buch ausgewählt.', 'warn');
			return;
		}
		const rowId = ID.unique();
		const data = { userId: this.user.$id, bookId: book.$id, ...input };
		this.events = [...this.events, { $id: rowId, ...data, pending: true }].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
		try {
			const sent = await this.send({
				kind: 'create',
				table: TABLES.events,
				rowId,
				data,
				permissions: bookPerms(this.user.$id, book)
			});
			if (sent) {
				this.events = this.events.map((item) => (item.$id === rowId ? { ...item, pending: false } : item));
				this.ping('Termin gespeichert.');
			} else {
				this.ping('Offline gespeichert. Wird später synchronisiert.', 'warn');
			}
		} catch (error) {
			this.events = this.events.filter((item) => item.$id !== rowId);
			this.ping(errorMessage(error) || 'Der Termin konnte nicht gespeichert werden.', 'warn');
		}
	}

	async deleteEvent(id: string) {
		this.events = this.events.filter((item) => item.$id !== id);
		await this.attempt(() => this.send({ kind: 'delete', table: TABLES.events, rowId: id }));
	}

	async toggleTask(task: Task) {
		const done = !task.done;
		this.patchTask(task.$id, { done });
		if (task.$id.startsWith('local:')) return;
		await this.attempt(() => this.send({ kind: 'update', table: TABLES.tasks, rowId: task.$id, data: { done } }));
	}

	async updateTask(id: string, data: Partial<Pick<Task, 'title' | 'details' | 'subject' | 'done'>>) {
		this.patchTask(id, data);
		if (id.startsWith('local:')) return;
		await this.attempt(async () => {
			await this.send({ kind: 'update', table: TABLES.tasks, rowId: id, data });
			const share = this.shareOf(id);
			if (!share) return;
			const task = this.tasks.find((item) => item.$id === id);
			const next = {
				title: task?.title ?? share.title,
				details: task?.details ?? share.details,
				subject: task?.subject ?? share.subject
			};
			this.shares = this.shares.map((item) => (item.$id === share.$id ? { ...item, ...next } : item));
			await this.send({ kind: 'update', table: TABLES.shares, rowId: share.$id, data: next });
		});
	}

	async deleteTask(task: Task) {
		this.tasks = this.tasks.filter((item) => item.$id !== task.$id);
		this.shares = this.shares.filter((share) => share.taskId !== task.$id);
		if (task.$id.startsWith('local:')) return;
		await this.attempt(() => this.send({ kind: 'delete-task', taskId: task.$id, fileIds: task.fileIds }));
	}

	async deleteNote(note: Note) {
		this.notes = this.notes.filter((item) => item.$id !== note.$id);
		this.shares = this.shares.filter((share) => !(share.kind === 'note' && share.taskId === note.$id));
		if (note.$id.startsWith('local:')) return;
		await this.attempt(async () => {
			const share = this.shareOf(note.$id, 'note');
			if (share) await this.send({ kind: 'delete', table: TABLES.shares, rowId: share.$id });
			await this.send({ kind: 'delete', table: TABLES.notes, rowId: note.$id });
		});
	}

	async updateNote(id: string, data: Partial<Pick<Note, 'title' | 'body' | 'subject'>>) {
		this.patchNote(id, data);
		if (id.startsWith('local:')) return;
		await this.attempt(async () => {
			await this.send({ kind: 'update', table: TABLES.notes, rowId: id, data });
			const share = this.shareOf(id, 'note');
			if (!share) return;
			const note = this.notes.find((item) => item.$id === id);
			const next = { title: note?.title ?? share.title, details: note?.body ?? share.details, subject: note?.subject ?? share.subject };
			this.shares = this.shares.map((item) => (item.$id === share.$id ? { ...item, ...next } : item));
			await this.send({ kind: 'update', table: TABLES.shares, rowId: share.$id, data: next });
		});
	}

	shareOf(itemId: string, kind: 'task' | 'note' = 'task') {
		return this.shares.find((share) => share.taskId === itemId && share.kind === kind) ?? null;
	}

	shareLink(shareId: string) {
		const origin =
			typeof location === 'undefined' || location.hostname === '127.0.0.1' || location.hostname === 'localhost'
				? 'https://hausi.appwrite.network'
				: location.origin;
		return `${origin}/teilen/${shareId}`;
	}

	private async upsertShare(itemId: string, kind: 'task' | 'note', data: { title: string; details: string; subject: string; fileIds: string[] }) {
		if (!this.user || this.needsInternet()) return '';
		const existing = this.shareOf(itemId, kind);
		const payload = { ...data, kind };
		if (existing) {
			await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.shares, rowId: existing.$id, data: payload });
			await this.publishFiles(data.fileIds, true);
			this.shares = this.shares.map((share) => (share.$id === existing.$id ? { ...share, ...payload } : share));
			return this.shareLink(existing.$id);
		}
		const created = await tables.createRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.shares,
			rowId: ID.unique(),
			data: { ...payload, userId: this.user.$id, taskId: itemId },
			permissions: [
				Permission.read(Role.any()),
				Permission.update(Role.user(this.user.$id)),
				Permission.delete(Role.user(this.user.$id))
			]
		});
		await this.publishFiles(data.fileIds, true);
		this.shares = [...this.shares, mapShare(created as unknown as Record<string, unknown>)];
		return this.shareLink(created.$id);
	}

	async shareTask(task: Task) {
		if (task.pending) return '';
		return this.upsertShare(task.$id, 'task', {
			title: task.title,
			details: task.details,
			subject: task.subject,
			fileIds: task.fileIds
		});
	}

	async shareNote(note: Note) {
		if (note.pending) return '';
		return this.upsertShare(note.$id, 'note', {
			title: note.title,
			details: note.body,
			subject: note.subject,
			fileIds: []
		});
	}

	async revokeShare(itemId: string, kind: 'task' | 'note' = 'task', fileIds: string[] = []) {
		const existing = this.shareOf(itemId, kind);
		if (!existing || this.needsInternet()) return;
		await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.shares, rowId: existing.$id });
		await this.publishFiles(fileIds, false);
		this.shares = this.shares.filter((share) => share.$id !== existing.$id);
	}

	async loadShare(id: string): Promise<Share | null> {
		try {
			const row = await tables.getRow({ databaseId: DATABASE_ID, tableId: TABLES.shares, rowId: id });
			return mapShare(row as Record<string, unknown>);
		} catch {
			return null;
		}
	}

	async adoptShare(share: Share) {
		if (share.kind === 'note') {
			await this.createNote({ title: share.title, body: share.details, subject: share.subject });
			return;
		}
		await this.createTask({
			title: share.title,
			details: share.details,
			subject: share.subject,
			lessonId: '',
			remindMode: 'none',
			remindAt: null,
			files: []
		});
	}

	async attachFiles(task: Task, files: File[]) {
		if (!this.user || files.length === 0 || this.needsInternet()) return;
		try {
			const ids = [...task.fileIds];
			for (const file of files) {
				const created = await storage.createFile({
					bucketId: BUCKET_ID,
					fileId: ID.unique(),
					file: toUploadFile(file),
					permissions: bookPerms(this.user.$id, this.books.find((book) => book.$id === task.bookId) ?? this.activeBook)
				});
				ids.push(created.$id);
			}
			await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: task.$id, data: { fileIds: ids } });
			this.patchTask(task.$id, { fileIds: ids });
			const share = this.shareOf(task.$id);
			if (share) {
				await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.shares, rowId: share.$id, data: { fileIds: ids } });
				await this.publishFiles(ids, true);
			}
			this.ping(files.length === 1 ? 'Datei gespeichert.' : `${files.length} Dateien gespeichert.`);
		} catch (error) {
			this.ping(errorMessage(error) || 'Die Datei konnte nicht gespeichert werden.', 'warn');
		}
	}

	fileUrl(fileId: string) {
		return storage.getFileView({ bucketId: BUCKET_ID, fileId });
	}

	async downloadFile(fileId: string) {
		if (this.needsInternet()) return;
		const meta = await storage.getFile({ bucketId: BUCKET_ID, fileId });
		const jwt = await account.createJWT();
		const response = await fetch(storage.getFileDownload({ bucketId: BUCKET_ID, fileId }), {
			headers: { 'X-Appwrite-JWT': jwt.jwt }
		});
		if (!response.ok) throw new Error('Download fehlgeschlagen');
		const blob = await response.blob();
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = meta.name;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	async flush() {
		if (this.flushing || !this.user || !isOnline()) return 0;
		this.flushing = true;
		let sent = 0;
		try {
			for (const op of await listQueue()) {
				try {
					await this.runOp(op);
					sent++;
				} catch (error) {
					if (isNetworkError(error) || isAuthError(error)) throw error;
					this.dropLocal(op, error);
				}
				await removeQueued(op.id);
			}
		} catch {
			/* bleibt in der Warteschlange */
		} finally {
			this.queued = await queueCount().catch(() => 0);
			this.flushing = false;
		}
		if (sent) {
			this.tasks = this.tasks.map((task) => (task.pending ? { ...task, pending: false } : task));
			this.notes = this.notes.map((note) => (note.pending ? { ...note, pending: false } : note));
			this.events = this.events.map((item) => (item.pending ? { ...item, pending: false } : item));
			this.ping(sent === 1 ? '1 Änderung synchronisiert.' : `${sent} Änderungen synchronisiert.`);
		}
		return sent;
	}

	private dropLocal(op: QueueOp, error: unknown) {
		if (errorCode(error) === 409) return;
		const rowId = op.kind === 'task' || op.kind === 'create' ? op.rowId : undefined;
		if (!rowId) return;
		this.tasks = this.tasks.filter((item) => item.$id !== rowId);
		this.notes = this.notes.filter((item) => item.$id !== rowId);
		this.lessons = this.lessons.filter((item) => item.$id !== rowId);
		this.timetables = this.timetables.filter((item) => item.$id !== rowId);
		this.events = this.events.filter((item) => item.$id !== rowId);
		this.books = this.books.filter((item) => item.$id !== rowId);
	}

	private async runOp(op: QueueOp) {
		if (!this.user) return;
		const userId = this.user.$id;
		switch (op.kind) {
			case 'task':
				await this.pushTask(op.payload, op.files, op.rowId, op.permissions);
				break;
			case 'create':
				await tables.createRow({
					databaseId: DATABASE_ID,
					tableId: op.table,
					rowId: op.rowId,
					data: op.data,
					permissions: op.permissions ?? own(userId)
				});
				break;
			case 'update':
				await tables.updateRow({ databaseId: DATABASE_ID, tableId: op.table, rowId: op.rowId, data: op.data });
				break;
			case 'delete':
				await tables.deleteRow({ databaseId: DATABASE_ID, tableId: op.table, rowId: op.rowId });
				break;
			case 'note':
				await tables.createRow({
					databaseId: DATABASE_ID,
					tableId: TABLES.notes,
					rowId: ID.unique(),
					data: op.payload,
					permissions: own(userId)
				});
				break;
			case 'patch-task':
				await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: op.taskId, data: op.data });
				break;
			case 'delete-task':
				await this.removeTaskRemote(op.taskId, op.fileIds ?? []);
				break;
			case 'delete-note':
				await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.notes, rowId: op.noteId });
				break;
		}
	}

	private async pushTask(payload: Record<string, unknown>, files: LocalFile[], rowId = ID.unique(), permissions?: string[]) {
		if (!this.user) return;
		const fileIds: string[] = [];
		for (const file of files) {
			const created = await storage.createFile({
				bucketId: BUCKET_ID,
				fileId: ID.unique(),
				file: fileFromLocal(file),
				permissions: permissions ?? own(this.user.$id)
			});
			fileIds.push(created.$id);
		}
		const data = Object.fromEntries(
			Object.entries({ ...payload, fileIds }).filter(([, value]) => value !== null && value !== undefined)
		);
		await tables.createRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.tasks,
			rowId,
			data,
			permissions: permissions ?? own(this.user.$id)
		});
		this.patchTask(rowId, { fileIds, pending: false });
	}

	private async publishFiles(fileIds: string[], shared: boolean) {
		if (!this.user) return;
		const permissions = shared ? [...own(this.user.$id), Permission.read(Role.any())] : own(this.user.$id);
		for (const fileId of fileIds) {
			try {
				await storage.updateFile({ bucketId: BUCKET_ID, fileId, permissions });
			} catch {
				/* Anhang kann schon weg sein */
			}
		}
	}

	private async removeTaskRemote(taskId: string, fileIds: string[]) {
		const found = await tables.listRows({
			databaseId: DATABASE_ID,
			tableId: TABLES.shares,
			queries: [Query.equal('taskId', taskId), Query.limit(5)]
		});
		for (const row of found.rows) {
			await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.shares, rowId: row.$id });
		}
		for (const fileId of fileIds) {
			try {
				await storage.deleteFile({ bucketId: BUCKET_ID, fileId });
			} catch {
				/* Datei kann schon weg sein */
			}
		}
		try {
			await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: taskId });
		} catch (error) {
			if (errorCode(error) !== 404) throw error;
		}
	}
}

async function filesFrom(files: File[]): Promise<LocalFile[]> {
	return Promise.all(
		files.map(async (file) => ({
			name: file.name,
			type: file.type,
			buffer: await file.arrayBuffer()
		}))
	);
}

export const hausi = new HausiStore();
