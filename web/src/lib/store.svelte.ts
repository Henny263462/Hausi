import { ID, Permission, Query, Role } from 'appwrite';
import { account, storage, tables } from './appwrite';
import { BUCKET_ID, DATABASE_ID, FREE_RETENTION_DAYS, TABLES } from './config';
import { enqueue, listQueue, queueCount, removeQueued, type QueueOp } from './queue';
import type { Lesson, LocalFile, Note, Profile, RemindMode, Task, Timetable } from './types';

function own(userId: string) {
	return [
		Permission.read(Role.user(userId)),
		Permission.update(Role.user(userId)),
		Permission.delete(Role.user(userId))
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

function mapNote(row: Record<string, unknown>): Note {
	return {
		$id: asString(row.$id),
		$createdAt: asString(row.$createdAt),
		userId: asString(row.userId),
		title: asString(row.title),
		body: asString(row.body),
		subject: asString(row.subject)
	};
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

class HausiStore {
	user = $state<{ $id: string; email: string; name: string } | null>(null);
	ready = $state(false);
	busy = $state(false);
	online = $state(true);
	profile = $state<Profile | null>(null);
	timetables = $state<Timetable[]>([]);
	lessons = $state<Lesson[]>([]);
	tasks = $state<Task[]>([]);
	notes = $state<Note[]>([]);
	queued = $state(0);
	toast = $state<{ text: string; tone: 'ok' | 'warn' } | null>(null);
	captureOpen = $state(false);
	private flushing = false;
	private started = false;

	get activeTimetable() {
		return (
			this.timetables.find((item) => item.$id === this.profile?.activeTimetableId) ??
			this.timetables.find((item) => item.active) ??
			this.timetables[0] ??
			null
		);
	}

	get activeLessons() {
		const id = this.activeTimetable?.$id;
		return id ? this.lessons.filter((lesson) => lesson.timetableId === id) : [];
	}

	get subjects() {
		return [...new Set(this.activeLessons.map((lesson) => lesson.subject))];
	}

	get hasSchedule() {
		return this.lessons.length > 0;
	}

	get openTasks() {
		return this.tasks.filter((task) => !task.done && !this.isExpired(task));
	}

	constructor() {
		if (typeof window !== 'undefined') {
			this.online = navigator.onLine;
			window.addEventListener('online', () => {
				this.online = true;
				void this.flush();
			});
			window.addEventListener('offline', () => {
				this.online = false;
			});
		}
	}

	ping(text: string, tone: 'ok' | 'warn' = 'ok') {
		this.toast = { text, tone };
		setTimeout(() => {
			if (this.toast?.text === text) this.toast = null;
		}, 3400);
	}

	isExpired(task: Task) {
		return !!task.expiresAt && new Date(task.expiresAt).getTime() < Date.now();
	}

	async init() {
		if (this.started) return;
		this.started = true;
		try {
			const user = await account.get();
			this.user = { $id: user.$id, email: user.email, name: user.name };
			await this.refresh();
			await this.flush();
		} catch {
			this.user = null;
		} finally {
			this.queued = await queueCount().catch(() => 0);
			this.ready = true;
		}
	}

	async refresh() {
		if (!this.user) return;
		const userId = this.user.$id;
		const [profiles, timetables, lessons, tasks, notes] = await Promise.all([
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
			})
		]);

		const profileRow = profiles.rows[0] as Record<string, unknown> | undefined;
		if (!profileRow) {
			const created = await tables.createRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.profiles,
				rowId: ID.unique(),
				data: { userId, name: this.user.name, premium: false, activeTimetableId: '' },
				permissions: own(userId)
			});
			this.profile = {
				$id: created.$id,
				userId,
				name: this.user.name,
				premium: false,
				activeTimetableId: ''
			};
		} else {
			this.profile = {
				$id: asString(profileRow.$id),
				userId,
				name: asString(profileRow.name) || this.user.name,
				premium: asBool(profileRow.premium),
				activeTimetableId: asString(profileRow.activeTimetableId)
			};
		}

		this.timetables = timetables.rows.map((row) => {
			const item = row as Record<string, unknown>;
			return {
				$id: asString(item.$id),
				userId: asString(item.userId),
				name: asString(item.name),
				active: asBool(item.active)
			};
		});
		this.lessons = lessons.rows.map((row) => {
			const item = row as Record<string, unknown>;
			return {
				$id: asString(item.$id),
				userId: asString(item.userId),
				timetableId: asString(item.timetableId),
				subject: asString(item.subject),
				weekday: Number(item.weekday),
				startMin: Number(item.startMin),
				endMin: Number(item.endMin),
				room: asString(item.room),
				color: asString(item.color)
			};
		});
		this.tasks = (tasks.rows as Record<string, unknown>[]).map(mapTask).filter((task) => !this.isExpired(task));
		this.notes = (notes.rows as Record<string, unknown>[]).map(mapNote);
	}

	async register(name: string, email: string, password: string) {
		await account.create({ userId: ID.unique(), email, password, name });
		await this.login(email, password);
	}

	async login(email: string, password: string) {
		await account.createEmailPasswordSession({ email, password });
		const user = await account.get();
		this.user = { $id: user.$id, email: user.email, name: user.name };
		await this.refresh();
	}

	async logout() {
		await account.deleteSession({ sessionId: 'current' });
		this.user = null;
		this.profile = null;
		this.timetables = [];
		this.lessons = [];
		this.tasks = [];
		this.notes = [];
	}

	async setPremium(premium: boolean) {
		if (!this.user || !this.profile) return;
		await tables.updateRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.profiles,
			rowId: this.profile.$id,
			data: { premium }
		});
		this.profile = { ...this.profile, premium };
		for (const task of this.tasks) {
			if (task.pending || task.$id.startsWith('local:')) continue;
			const expiresAt = premium ? null : freshExpiry(false, new Date(task.$createdAt));
			await tables.updateRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.tasks,
				rowId: task.$id,
				data: { expiresAt }
			});
		}
		await this.refresh();
		this.ping(premium ? 'Premium ist an. Aufgaben bleiben erhalten.' : 'Kostenlos: Aufgaben bleiben 2 Monate.');
	}

	async createTimetable(name: string) {
		if (!this.user) return;
		const active = this.timetables.length === 0;
		const row = await tables.createRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.timetables,
			rowId: ID.unique(),
			data: { userId: this.user.$id, name, active },
			permissions: own(this.user.$id)
		});
		if (active && this.profile) {
			await tables.updateRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.profiles,
				rowId: this.profile.$id,
				data: { activeTimetableId: row.$id }
			});
		}
		await this.refresh();
	}

	async renameTimetable(id: string, name: string) {
		await tables.updateRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.timetables,
			rowId: id,
			data: { name }
		});
		await this.refresh();
	}

	async activateTimetable(id: string) {
		if (!this.profile) return;
		for (const timetable of this.timetables) {
			if (timetable.active !== (timetable.$id === id)) {
				await tables.updateRow({
					databaseId: DATABASE_ID,
					tableId: TABLES.timetables,
					rowId: timetable.$id,
					data: { active: timetable.$id === id }
				});
			}
		}
		await tables.updateRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.profiles,
			rowId: this.profile.$id,
			data: { activeTimetableId: id }
		});
		await this.refresh();
	}

	async deleteTimetable(id: string) {
		const related = this.lessons.filter((lesson) => lesson.timetableId === id);
		for (const lesson of related) {
			await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.lessons, rowId: lesson.$id });
		}
		await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.timetables, rowId: id });
		await this.refresh();
		const next = this.timetables[0];
		if (next) await this.activateTimetable(next.$id);
	}

	async addLesson(input: Omit<Lesson, '$id' | 'userId'>) {
		if (!this.user) return;
		await tables.createRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.lessons,
			rowId: ID.unique(),
			data: { ...input, userId: this.user.$id },
			permissions: own(this.user.$id)
		});
		await this.refresh();
	}

	async deleteLesson(id: string) {
		await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.lessons, rowId: id });
		await this.refresh();
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
		const payload: Record<string, unknown> = {
			userId: this.user.$id,
			title: input.title,
			details: input.details,
			subject: input.subject,
			lessonId: input.lessonId,
			timetableId: this.activeTimetable?.$id ?? '',
			done: false,
			remindMode: input.remindAt ? input.remindMode : 'none',
			remindAt: input.remindAt,
			reminderSent: false,
			expiresAt: freshExpiry(this.profile.premium),
			fileIds: [] as string[]
		};

		const localId = `local:${crypto.randomUUID()}`;
		const optimistic: Task = {
			...(payload as Omit<Task, '$id' | '$createdAt' | 'pending' | 'fileIds' | 'remindAt' | 'expiresAt'>),
			$id: localId,
			$createdAt: new Date().toISOString(),
			remindAt: input.remindAt,
			expiresAt: freshExpiry(this.profile.premium),
			fileIds: [],
			pending: true
		};
		this.tasks = [optimistic, ...this.tasks];

		const files = await filesFrom(input.files);
		if (!isOnline()) {
			await enqueue({ id: localId, kind: 'task', payload, files });
			this.queued = await queueCount();
			this.ping('Kein Internet. Die Aufgabe wartet in der Warteschlange.', 'warn');
			return;
		}

		try {
			await this.pushTask(payload, files);
			this.tasks = this.tasks.filter((task) => task.$id !== localId);
			await this.refresh();
			this.ping('Aufgabe gespeichert. Die Erinnerung kommt per E-Mail.');
		} catch {
			await enqueue({ id: localId, kind: 'task', payload, files });
			this.queued = await queueCount();
			this.ping('Speichern klappt gerade nicht. Die Aufgabe liegt in der Warteschlange.', 'warn');
		}
	}

	async createNote(input: { title: string; body: string; subject: string }) {
		if (!this.user) return;
		const payload = {
			userId: this.user.$id,
			title: input.title,
			body: input.body,
			subject: input.subject
		};
		const localId = `local:${crypto.randomUUID()}`;
		this.notes = [
			{
				$id: localId,
				$createdAt: new Date().toISOString(),
				...payload,
				pending: true
			},
			...this.notes
		];
		if (!isOnline()) {
			await enqueue({ id: localId, kind: 'note', payload });
			this.queued = await queueCount();
			this.ping('Kein Internet. Die Notiz wartet in der Warteschlange.', 'warn');
			return;
		}
		try {
			await tables.createRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.notes,
				rowId: ID.unique(),
				data: payload,
				permissions: own(this.user.$id)
			});
			this.notes = this.notes.filter((note) => note.$id !== localId);
			await this.refresh();
			this.ping('Notiz gespeichert.');
		} catch {
			await enqueue({ id: localId, kind: 'note', payload });
			this.queued = await queueCount();
			this.ping('Speichern klappt gerade nicht. Die Notiz liegt in der Warteschlange.', 'warn');
		}
	}

	async toggleTask(task: Task) {
		const done = !task.done;
		this.tasks = this.tasks.map((item) => (item.$id === task.$id ? { ...item, done } : item));
		if (task.pending || task.$id.startsWith('local:')) return;
		const data = { done };
		if (!isOnline()) {
			await enqueue({ id: crypto.randomUUID(), kind: 'patch-task', taskId: task.$id, data });
			this.queued = await queueCount();
			return;
		}
		try {
			await tables.updateRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.tasks,
				rowId: task.$id,
				data
			});
		} catch {
			await enqueue({ id: crypto.randomUUID(), kind: 'patch-task', taskId: task.$id, data });
			this.queued = await queueCount();
		}
	}

	async updateTask(id: string, data: Partial<Pick<Task, 'title' | 'details' | 'subject' | 'done'>>) {
		await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: id, data });
		await this.refresh();
	}

	async attachFiles(task: Task, files: File[]) {
		if (!this.user || files.length === 0) return;
		const ids = [...task.fileIds];
		for (const file of files) {
			const created = await storage.createFile({
				bucketId: BUCKET_ID,
				fileId: ID.unique(),
				file,
				permissions: own(this.user.$id)
			});
			ids.push(created.$id);
		}
		await tables.updateRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.tasks,
			rowId: task.$id,
			data: { fileIds: ids }
		});
		await this.refresh();
	}

	async deleteTask(task: Task) {
		this.tasks = this.tasks.filter((item) => item.$id !== task.$id);
		if (task.pending || task.$id.startsWith('local:')) return;
		if (!isOnline()) {
			await enqueue({ id: crypto.randomUUID(), kind: 'delete-task', taskId: task.$id });
			this.queued = await queueCount();
			return;
		}
		await this.removeTaskRemote(task.$id, task.fileIds);
	}

	async deleteNote(note: Note) {
		this.notes = this.notes.filter((item) => item.$id !== note.$id);
		if (note.pending || note.$id.startsWith('local:')) return;
		if (!isOnline()) {
			await enqueue({ id: crypto.randomUUID(), kind: 'delete-note', noteId: note.$id });
			this.queued = await queueCount();
			return;
		}
		await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.notes, rowId: note.$id });
	}

	async updateNote(id: string, data: Partial<Pick<Note, 'title' | 'body' | 'subject'>>) {
		await tables.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.notes, rowId: id, data });
		await this.refresh();
	}

	fileUrl(fileId: string) {
		return storage.getFileView({ bucketId: BUCKET_ID, fileId });
	}

	async downloadFile(fileId: string) {
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
		if (this.flushing || !this.user || !isOnline()) return;
		this.flushing = true;
		try {
			const ops = await listQueue();
			for (const op of ops) {
				await this.runOp(op);
				await removeQueued(op.id);
			}
			if (ops.length) {
				await this.refresh();
				this.ping(`${ops.length} Eintrag aus der Warteschlange gesendet.`);
			}
		} catch {
			this.ping('Die Warteschlange wartet auf eine stabile Verbindung.', 'warn');
		} finally {
			this.queued = await queueCount().catch(() => 0);
			this.flushing = false;
		}
	}

	private async runOp(op: QueueOp) {
		if (!this.user) return;
		if (op.kind === 'task') await this.pushTask(op.payload, op.files);
		if (op.kind === 'note') {
			await tables.createRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.notes,
				rowId: ID.unique(),
				data: op.payload,
				permissions: own(this.user.$id)
			});
		}
		if (op.kind === 'patch-task') {
			await tables.updateRow({
				databaseId: DATABASE_ID,
				tableId: TABLES.tasks,
				rowId: op.taskId,
				data: op.data
			});
		}
		if (op.kind === 'delete-task') await this.removeTaskRemote(op.taskId, []);
		if (op.kind === 'delete-note') {
			await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.notes, rowId: op.noteId });
		}
	}

	private async pushTask(payload: Record<string, unknown>, files: LocalFile[]) {
		if (!this.user) return;
		const fileIds: string[] = [];
		for (const file of files) {
			const created = await storage.createFile({
				bucketId: BUCKET_ID,
				fileId: ID.unique(),
				file: new File([file.buffer], file.name, { type: file.type || 'application/octet-stream' }),
				permissions: own(this.user.$id)
			});
			fileIds.push(created.$id);
		}
		const data = Object.fromEntries(
			Object.entries({ ...payload, fileIds }).filter(([, value]) => value !== null && value !== undefined)
		);
		await tables.createRow({
			databaseId: DATABASE_ID,
			tableId: TABLES.tasks,
			rowId: ID.unique(),
			data,
			permissions: own(this.user.$id)
		});
	}

	private async removeTaskRemote(taskId: string, fileIds: string[]) {
		for (const fileId of fileIds) {
			try {
				await storage.deleteFile({ bucketId: BUCKET_ID, fileId });
			} catch {
				/* Datei kann schon weg sein */
			}
		}
		try {
			await tables.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: taskId });
		} catch {
			/* schon gelöscht */
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
